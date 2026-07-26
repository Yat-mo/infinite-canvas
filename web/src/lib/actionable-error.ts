export type ActionableError = {
    title: string;
    detail: string;
    actions: string[];
};

/** Map generation/network failures to next-step guidance for users. */
export function toActionableError(error: unknown): ActionableError {
    const message = error instanceof Error ? error.message : String(error || "未知错误");
    const lower = message.toLowerCase();

    if (/未登录|登录|token|401|权限不足/.test(message) || lower.includes("unauthorized")) {
        return {
            title: "需要登录或权限不足",
            detail: message,
            actions: ["先登录账号", "若使用云端渠道请确认管理员已开放远程渠道", "本地渠道改为浏览器直连并检查 API Key"],
        };
    }
    if (/api key|base url|渠道|未配置|缺少模型/.test(message) || lower.includes("api key")) {
        return {
            title: "渠道配置不完整",
            detail: message,
            actions: ["打开右上角配置，补全 Base URL / API Key / 模型", "点击测通生成确认可用", "云端渠道请在管理后台添加渠道与模型"],
        };
    }
    if (/超时|timeout|network|连接失败|econn|fetch/.test(lower) || /连接失败|超时/.test(message)) {
        return {
            title: "网络或上游超时",
            detail: message,
            actions: ["检查本机网络与上游 Base URL", "增大渠道超时时间后重试", "查看上游服务是否限流或宕机"],
        };
    }
    if (/算力|credits|余额/.test(message)) {
        return {
            title: "算力点不足",
            detail: message,
            actions: ["联系管理员增加算力", "切换到本地渠道使用自有 Key", "降低批量数量后重试"],
        };
    }
    if (/敏感|safety|content|违规|blocked/.test(lower) || /敏感|违规/.test(message)) {
        return {
            title: "内容被上游安全策略拦截",
            detail: message,
            actions: ["改写提示词后重试", "替换参考图/视频", "更换模型或渠道"],
        };
    }
    if (/过大|entity too large|413|maxbytes|50mb|体积/.test(lower) || /过大/.test(message)) {
        return {
            title: "上传或响应体积超限",
            detail: message,
            actions: ["压缩图片/视频后重试", "减少参考素材数量", "改用对象存储外链"],
        };
    }
    if (/频繁|rate|429/.test(lower) || /频繁/.test(message)) {
        return {
            title: "请求过于频繁",
            detail: message,
            actions: ["等待片刻后重试", "降低并发任务数", "检查是否被登录/接口限流"],
        };
    }
    return {
        title: "生成失败",
        detail: message,
        actions: ["查看配置与模型是否可用", "缩小提示词或去掉参考素材后重试", "如持续失败请查看后端日志或上游返回"],
    };
}

export function formatActionableError(error: unknown) {
    const item = toActionableError(error);
    return `${item.title}：${item.detail}（下一步：${item.actions[0]}）`;
}
