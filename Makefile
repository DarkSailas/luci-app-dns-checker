include $(TOPDIR)/rules.mk

LUCI_TITLE:=DNS Benchmark and Configuration Selector
LUCI_DEPENDS:=+bind-dig +curl +jq
LUCI_PKGARCH:=all
PKG_VERSION:=1.2.7
PKG_RELEASE:=1

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature