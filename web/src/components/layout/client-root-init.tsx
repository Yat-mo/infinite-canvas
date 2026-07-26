"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { App } from "antd";

import { fetchUserConfig } from "@/services/api/user-config";
import { defaultUserStorageProvider, saveUserStorageProvider } from "@/services/image-storage";
import { useConfigStore, type AiConfig } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

function readHashConfig() {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    if (!hash) return { baseUrl: "", apiKey: "" };
    const params = new URLSearchParams(hash);
    return {
        baseUrl: params.get("baseUrl") || params.get("baseurl") || "",
        apiKey: params.get("apiKey") || params.get("apikey") || "",
    };
}

function clearSensitiveQueryParams() {
    const searchParams = new URLSearchParams(window.location.search);
    let changed = false;
    for (const key of ["apiKey", "apikey", "baseUrl", "baseurl"]) {
        if (searchParams.has(key)) {
            searchParams.delete(key);
            changed = true;
        }
    }
    if (!changed) return false;
    const next = `${window.location.pathname}${searchParams.size ? `?${searchParams}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", next);
    return true;
}

export function ClientRootInit({ children }: { children: ReactNode }) {
    const { message } = App.useApp();
    const handledConfigParams = useRef(false);
    const pathname = usePathname();
    const token = useUserStore((state) => state.token);
    const user = useUserStore((state) => state.user);
    const hydrateUser = useUserStore((state) => state.hydrateUser);
    const loadPublicSettings = useConfigStore((state) => state.loadPublicSettings);
    const publicSettings = useConfigStore((state) => state.publicSettings);
    const channelMode = useConfigStore((state) => state.config.channelMode);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const isLoginPage = pathname === "/login" || pathname === "/admin/login";
    const adminRemoteTokenRef = useRef("");

    useEffect(() => {
        void loadPublicSettings();
    }, [loadPublicSettings]);

    useEffect(() => {
        if (!isLoginPage) void hydrateUser();
    }, [hydrateUser, isLoginPage]);

    useEffect(() => {
        if (!token || user?.role !== "admin" || adminRemoteTokenRef.current === token) return;
        adminRemoteTokenRef.current = token;
        if (channelMode !== "remote") updateConfig("channelMode", "remote");
    }, [channelMode, token, updateConfig, user?.role]);

    useEffect(() => {
        if (!token || !user?.id) return;
        void fetchUserConfig(token)
            .then((payload) => {
                const syncModel = payload.modelConfig?.syncModelConfig === true;
                const syncStorage = payload.modelConfig?.syncStorageConfig === true;
                if (payload.modelConfig) {
                    Object.entries(payload.modelConfig)
                        .filter(([key]) => syncModel || !["apiKey", "baseUrl", "localChannels"].includes(key))
                        .forEach(([key, value]) => updateConfig(key as keyof AiConfig, value as never));
                } else {
                    updateConfig("syncModelConfig", false);
                }
                updateConfig("syncStorageConfig", syncStorage);
                if (syncStorage && payload.storageProvider) {
                    saveUserStorageProvider({
                        ...defaultUserStorageProvider(),
                        ...payload.storageProvider,
                        enabled: payload.storageProvider.enabled !== undefined ? payload.storageProvider.enabled : true,
                    });
                }
            })
            .catch(() => {});
    }, [token, updateConfig, user?.id]);

    useEffect(() => {
        // Never accept secrets from query string; strip if present.
        if (clearSensitiveQueryParams()) {
            message.warning("已忽略 URL 查询参数中的密钥，请改用 #apiKey=...&baseUrl=... 片段注入");
        }
    }, [message]);

    useEffect(() => {
        if (handledConfigParams.current) return;
        const { baseUrl, apiKey } = readHashConfig();
        if (!baseUrl && !apiKey) return;
        if (!publicSettings) return;
        handledConfigParams.current = true;
        // Clear hash after reading secrets so they do not linger in history UI.
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        if (!publicSettings.modelChannel.allowCustomChannel) {
            openConfigDialog(false);
            message.error("后台未允许用户自定义渠道，请联系管理员进行配置");
            return;
        }
        updateConfig("channelMode", "local");
        if (baseUrl) updateConfig("baseUrl", baseUrl);
        if (apiKey) updateConfig("apiKey", apiKey);
        openConfigDialog(false);
        message.success("已从安全片段写入渠道配置");
    }, [message, openConfigDialog, publicSettings, updateConfig]);

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            const data = event.data as { type?: string; baseUrl?: string; apiKey?: string } | null;
            if (!data || data.type !== "infinite-canvas:channel-config") return;
            if (!publicSettings?.modelChannel.allowCustomChannel) {
                message.error("后台未允许用户自定义渠道");
                return;
            }
            updateConfig("channelMode", "local");
            if (data.baseUrl) updateConfig("baseUrl", data.baseUrl);
            if (data.apiKey) updateConfig("apiKey", data.apiKey);
            openConfigDialog(false);
            message.success("已通过 postMessage 写入渠道配置");
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [message, openConfigDialog, publicSettings, updateConfig]);

    return <>{children}</>;
}
