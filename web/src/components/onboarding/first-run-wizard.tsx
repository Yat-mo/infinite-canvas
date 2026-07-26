"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Button, Input, Modal, Radio, Space, Steps, Typography } from "antd";

import { formatActionableError } from "@/lib/actionable-error";
import { buildApiUrl, normalizeLocalChannels, useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

const STORAGE_KEY = "infinite-canvas:onboarding-v1";

async function probeLocalChannel(baseUrl: string, apiKey: string) {
    const url = buildApiUrl(baseUrl, "/models");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: "application/json",
            },
            signal: controller.signal,
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(text || `上游返回 ${response.status}`);
        }
        return "本地渠道测通成功（/models）";
    } finally {
        window.clearTimeout(timer);
    }
}

async function probeRemoteChannel(token: string | null) {
    const health = await fetch("/api/health", { method: "GET" });
    if (!health.ok) {
        throw new Error(`服务健康检查失败：${health.status}`);
    }
    if (!token) {
        return "服务健康检查通过（未登录，仅验证本地网关）";
    }
    const settings = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!settings.ok) {
        const payload = (await settings.json().catch(() => null)) as { msg?: string } | null;
        throw new Error(payload?.msg || `读取公开设置失败：${settings.status}`);
    }
    return "云端路径测通成功（/api/health + /api/settings）";
}

export function FirstRunWizard() {
    const { message } = App.useApp();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(0);
    const [probing, setProbing] = useState(false);
    const [probeResult, setProbeResult] = useState("");
    const config = useConfigStore((state) => state.config);
    const publicSettings = useConfigStore((state) => state.publicSettings);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const user = useUserStore((state) => state.user);
    const token = useUserStore((state) => state.token);

    const localChannels = useMemo(() => normalizeLocalChannels(config), [config]);
    const activeLocal = localChannels[0];
    const localReady = Boolean(activeLocal?.baseUrl.trim() && activeLocal?.apiKey.trim() && (activeLocal.models?.length || config.imageModel || config.model));
    const remoteReady = Boolean(token && config.channelMode === "remote");

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.localStorage.getItem(STORAGE_KEY) === "done") return;
        const timer = window.setTimeout(() => setOpen(true), 600);
        return () => window.clearTimeout(timer);
    }, []);

    const finish = () => {
        window.localStorage.setItem(STORAGE_KEY, "done");
        setOpen(false);
        message.success("已完成首次配置，可在画布空状态选择配方开始创作");
    };

    const skip = () => {
        window.localStorage.setItem(STORAGE_KEY, "done");
        setOpen(false);
    };

    const runProbe = async () => {
        setProbing(true);
        setProbeResult("");
        try {
            const result =
                config.channelMode === "local"
                    ? await probeLocalChannel(activeLocal?.baseUrl || config.baseUrl, activeLocal?.apiKey || config.apiKey)
                    : await probeRemoteChannel(token);
            setProbeResult(result);
            message.success(result);
        } catch (error) {
            const text = formatActionableError(error);
            setProbeResult(text);
            message.error(text);
        } finally {
            setProbing(false);
        }
    };

    return (
        <Modal open={open} onCancel={skip} footer={null} title="首次运行向导" destroyOnClose width={560}>
            <Steps size="small" current={step} className="mb-6" items={[{ title: "选择模式" }, { title: "配置模型" }, { title: "真实测通" }]} />
            {step === 0 ? (
                <div className="space-y-4">
                    <Typography.Paragraph type="secondary">先选择你如何接入模型。本地直连使用你自己的 Key；云端渠道走服务端代理与算力。</Typography.Paragraph>
                    <Radio.Group value={config.channelMode} onChange={(event) => updateConfig("channelMode", event.target.value)} className="flex flex-col gap-3">
                        <Radio value="local">本地直连（浏览器请求你的 OpenAI 兼容接口）</Radio>
                        <Radio value="remote" disabled={!token}>
                            云端渠道{!token ? "（需先登录）" : user?.role === "admin" ? "" : "（需管理员开放）"}
                        </Radio>
                    </Radio.Group>
                    <Space>
                        <Button onClick={skip}>稍后设置</Button>
                        <Button type="primary" onClick={() => setStep(1)}>
                            下一步
                        </Button>
                    </Space>
                </div>
            ) : null}
            {step === 1 ? (
                <div className="space-y-4">
                    {config.channelMode === "local" ? (
                        <>
                            <Input
                                placeholder="Base URL，例如 https://api.example.com/v1"
                                value={activeLocal?.baseUrl || config.baseUrl}
                                onChange={(event) => {
                                    const channels = normalizeLocalChannels(config);
                                    const next = channels.length ? [...channels] : [{ id: "local-default", name: "本地直连", baseUrl: "", apiKey: "", models: [] }];
                                    next[0] = { ...next[0], baseUrl: event.target.value };
                                    updateConfig("localChannels", next);
                                    updateConfig("baseUrl", event.target.value);
                                }}
                            />
                            <Input.Password
                                placeholder="API Key"
                                value={activeLocal?.apiKey || config.apiKey}
                                onChange={(event) => {
                                    const channels = normalizeLocalChannels(config);
                                    const next = channels.length ? [...channels] : [{ id: "local-default", name: "本地直连", baseUrl: "", apiKey: "", models: [] }];
                                    next[0] = { ...next[0], apiKey: event.target.value };
                                    updateConfig("localChannels", next);
                                    updateConfig("apiKey", event.target.value);
                                }}
                            />
                            <Input
                                placeholder="默认图片模型名"
                                value={config.imageModel || config.model}
                                onChange={(event) => {
                                    updateConfig("imageModel", event.target.value);
                                    updateConfig("model", event.target.value);
                                    const channels = normalizeLocalChannels(config);
                                    const next = channels.length ? [...channels] : [{ id: "local-default", name: "本地直连", baseUrl: "", apiKey: "", models: [] }];
                                    if (!next[0].models?.includes(event.target.value) && event.target.value.trim()) {
                                        next[0] = { ...next[0], models: [...(next[0].models || []), event.target.value.trim()] };
                                        updateConfig("localChannels", next);
                                    }
                                }}
                            />
                        </>
                    ) : (
                        <Typography.Paragraph>
                            云端模式将使用后台配置的渠道与默认模型
                            <br />
                            默认图片模型：{publicSettings?.modelChannel.defaultImageModel || publicSettings?.modelChannel.defaultModel || "（未配置）"}
                        </Typography.Paragraph>
                    )}
                    <Space>
                        <Button onClick={() => setStep(0)}>上一步</Button>
                        <Button onClick={() => openConfigDialog(false)}>打开完整配置</Button>
                        <Button type="primary" onClick={() => setStep(2)} disabled={!(config.channelMode === "local" ? localReady : remoteReady)}>
                            下一步
                        </Button>
                    </Space>
                </div>
            ) : null}
            {step === 2 ? (
                <div className="space-y-4">
                    <Typography.Paragraph>
                        将真实请求上游/本地网关：
                        <br />
                        {config.channelMode === "local" ? "GET {baseUrl}/models（带 API Key）" : "GET /api/health 与 /api/settings"}
                    </Typography.Paragraph>
                    {probeResult ? <Typography.Paragraph type={probeResult.includes("成功") || probeResult.includes("通过") ? undefined : "danger"}>{probeResult}</Typography.Paragraph> : null}
                    <Space wrap>
                        <Button onClick={() => setStep(1)}>上一步</Button>
                        <Button loading={probing} onClick={() => void runProbe()}>
                            开始测通
                        </Button>
                        <Button type="primary" onClick={finish} disabled={!probeResult || probing || !(probeResult.includes("成功") || probeResult.includes("通过"))}>
                            完成并开始使用
                        </Button>
                    </Space>
                </div>
            ) : null}
        </Modal>
    );
}
