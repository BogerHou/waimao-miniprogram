"use strict";
Component({
    options: {
        multipleSlots: true
    },
    properties: {
        title: {
            type: String,
            value: ''
        },
        showBack: {
            type: Boolean,
            value: true
        },
        background: {
            type: String,
            value: '#fff'
        }
    },
    data: {
        statusBarHeight: 0,
        navBarHeight: 44
    },
    lifetimes: {
        attached() {
            const wxCompat = wx;
            const windowInfo = wxCompat.getWindowInfo?.();
            const deviceInfo = wxCompat.getDeviceInfo?.();
            const fallbackInfo = windowInfo && deviceInfo ? null : wx.getSystemInfoSync();
            const statusBarHeight = windowInfo?.statusBarHeight || fallbackInfo?.statusBarHeight || 0;
            // 导航栏高度：iOS 44px，Android 48px
            const platform = deviceInfo?.platform ?? fallbackInfo?.platform ?? '';
            const navBarHeight = platform === 'android' ? 48 : 44;
            this.setData({
                statusBarHeight,
                navBarHeight
            });
        }
    },
    methods: {
        onBack() {
            this.triggerEvent('back');
            wx.navigateBack({
                delta: 1
            });
        }
    }
});
