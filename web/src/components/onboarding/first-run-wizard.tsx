"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Button, Input, Modal, Radio, Space, Steps, Typography } from "antd";

import { useConfigStore, normalizeLocalChannels } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

const STORAGE_KEY = "infinite-canvas:onboarding-v1";

export function FirstRunWizard() {
    const { message } = App.useApp();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(0);
    const config = useConfigStore((state) => state.config);
    const publicSettings = useConfigStore((state) => state.publicSettings);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const user = useUserStore((state) => state.user);
    const token = useUserStore((state) => state.token);

    const localChannels = useMemo(() => normalizeLocalChannels(config), [config]);
    const localReady = localChannels.some((channel) => channel.baseUrl.trim() && channel.apiKey.trim() && (channel.models?.length || config.imageModel || config.model));
    const remoteReady = Boolean(token && config.channelMode === "remote" && (config.imageModel || config.model || publicSettings?.modelChannel.defaultImageModel));

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.localStorage.getItem(STORAGE_KEY) === "done") return;
        // Delay so public settings hydrate first.
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

    return (
        <Modal open={open} onCancel={skip} footer={null} title="首次运行向导" destroyOnClose width={560}>
            <Steps
                size="small"
                current={step}
                className="mb-6"
                items={[{ title: "选择模式" }, { title: "配置模型" }, { title: "测通确认" }]}
            />
            {step === 0 ? (
                <div className="space-y-4">
                    <Typography.Paragraph type="secondary">先选择你如何接入模型。本地直连使用你自己的 Key；云端渠道走服务端代理与算力。</Typography.Paragraph>
                    <Radio.Group
                        value={config.channelMode}
                        onChange={(event) => updateConfig("channelMode", event.target.value)}
                        className="flex flex-col gap-3"
                    >
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
                                value={localChannels[0]?.baseUrl || config.baseUrl}
                                onChange={(event) => {
                                    const channels = normalizeLocalChannels(config);
                                    const next = channels.length ? channels : [{ id: "local-default", name: "本地直连", baseUrl: "", apiKey: "", models: [] }];
                                    next[0] = { ...next[0], baseUrl: event.target.value };
                                    updateConfig("localChannels", next);
                                    updateConfig("baseUrl", event.target.value);
                                }}
                            />
                            <Input.Password
                                placeholder="API Key"
                                value={localChannels[0]?.apiKey || config.apiKey}
                                onChange={(event) => {
                                    const channels = normalizeLocalChannels(config);
                                    const next = channels.length ? channels : [{ id: "local-default", name: "本地直连", baseUrl: "", apiKey: "", models: [] }];
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
                        <Button type="primary" onClick={() => setStep(2)}>
                            下一步
                        </Button>
                    </Space>
                </div>
            ) : null}
            {step === 2 ? (
                <div className="space-y-4">
                    <Typography.Paragraph>
                        配置检查：
                        <br />
                        {config.channelMode === "local" ? (localReady ? "本地渠道字段已填写" : "请补全 Base URL、API Key 与模型名") : remoteReady ? "云端渠道可用（已登录）" : "云端渠道尚未就绪"}
                    </Typography.Paragraph>
                    <Typography.Paragraph type="secondary">真正的“测通”请在生图工作台或画布中发起一次生成；这里只确认最小配置是否齐全。</Typography.Paragraph>
                    <Space>
                        <Button onClick={() => setStep(1)}>上一步</Button>
                        <Button type="primary" onClick={finish} disabled={!(config.channelMode === "local" ? localReady : remoteReady)}>
                            完成并开始使用
                        </Button>
                    </Space>
                </div>
            ) : null}
        </Modal>
    );
}
