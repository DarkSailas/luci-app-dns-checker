#!/bin/sh
# ==============================================================================
# Uninstaller for luci-app-dns-checker
# https://github.com/DarkSailas/luci-app-dns-checker
# ==============================================================================

set -e

BACKUP_DIR="/etc/dns-checker"
RESTORE_CONFIG=1

for arg in "$@"; do
    case "$arg" in
        --no-restore) RESTORE_CONFIG=0 ;;
    esac
done

echo "=========================================================="
echo ">>> Removing luci-app-dns-checker..."
echo "=========================================================="

# Stop watching the primary DNS. If the backup server is at work now, the engine
# puts the primary one back into sing-box
uci -q delete dns-checker.failover || true
uci -q delete podkop.settings.backup_dns_type || true
uci -q delete podkop.settings.backup_dns_server || true
uci -q commit dns-checker || true
uci -q commit podkop || true
if [ -x /usr/bin/dns-checker-engine ]; then
    /usr/bin/dns-checker-engine failover_setup >/dev/null 2>&1 || true
fi
if [ -f /etc/init.d/dns-checker ]; then
    /etc/init.d/dns-checker stop >/dev/null 2>&1 || true
    /etc/init.d/dns-checker disable >/dev/null 2>&1 || true
    rm -f /etc/init.d/dns-checker
fi
rm -rf /tmp/dns-checker
# daily DNS autopick
if grep -q '# dns-checker autopick' /etc/crontabs/root 2>/dev/null; then
    sed -i '/# dns-checker autopick/d' /etc/crontabs/root
    /etc/init.d/cron restart >/dev/null 2>&1 || true
fi

if [ "$RESTORE_CONFIG" -eq 1 ] && [ -f "$BACKUP_DIR/initial_backup.tar.gz" ]; then
    echo ">>> Restoring original network and podkop configuration..."
    # only the configuration files: an archive of an old version also holds the podkop script
    for m in etc/config/podkop etc/config/network etc/config/dhcp; do
        tar -xzf "$BACKUP_DIR/initial_backup.tar.gz" -C / "$m" 2>/dev/null || true
    done
    /etc/init.d/dnsmasq restart >/dev/null 2>&1 || true
    /etc/init.d/podkop restart >/dev/null 2>&1 || true
    echo ">>> Initial configuration successfully restored!"
else
    echo ">>> Preserving current network and podkop configuration."
fi

echo ">>> Removing application files..."
rm -f /usr/bin/dns-checker-engine
rm -f /usr/share/luci/menu.d/luci-app-dns-checker.json
rm -f /usr/share/rpcd/acl.d/luci-app-dns-checker.json
rm -rf /www/luci-static/resources/view/dns-checker
rm -rf /etc/config/dns-checker
rm -rf "$BACKUP_DIR"

echo ">>> Cleaning LuCI caches..."
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache*
/etc/init.d/rpcd restart >/dev/null 2>&1 || true
/etc/init.d/uhttpd restart >/dev/null 2>&1 || true

echo "=========================================================="
echo ">>> luci-app-dns-checker has been completely removed."
echo "=========================================================="