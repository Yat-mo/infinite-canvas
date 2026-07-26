import type { CanvasProject } from "@/app/(user)/canvas/stores/use-canvas-store";
import { CanvasNodeType, type CanvasNodeData, type CanvasConnection } from "@/app/(user)/canvas/types";

export type CanvasRecipe = {
    id: string;
    title: string;
    description: string;
    build: () => Pick<CanvasProject, "title" | "nodes" | "connections">;
};

function node(partial: Omit<CanvasNodeData, "id"> & { id?: string }, id: string): CanvasNodeData {
    return {
        id,
        type: partial.type,
        title: partial.title,
        position: partial.position,
        width: partial.width,
        height: partial.height,
        metadata: partial.metadata || {},
    };
}

function connection(id: string, fromNodeId: string, toNodeId: string): CanvasConnection {
    return { id, fromNodeId, toNodeId };
}

export const canvasRecipes: CanvasRecipe[] = [
    {
        id: "text-to-image",
        title: "文生图迭代",
        description: "文本节点连到图片节点，适合快速试风格",
        build: () => ({
            title: "配方：文生图迭代",
            nodes: [
                node({ type: CanvasNodeType.Text, title: "提示词", position: { x: 120, y: 160 }, width: 280, height: 180, metadata: { content: "一只在赛博朋克街头的橘猫，电影光效，高细节" } }, "recipe-text-1"),
                node({ type: CanvasNodeType.Image, title: "生成图", position: { x: 480, y: 140 }, width: 320, height: 320, metadata: {} }, "recipe-image-1"),
            ],
            connections: [connection("recipe-c-1", "recipe-text-1", "recipe-image-1")],
        }),
    },
    {
        id: "image-to-image",
        title: "参考图改图",
        description: "图片参考连到新的图片节点",
        build: () => ({
            title: "配方：参考图改图",
            nodes: [
                node({ type: CanvasNodeType.Image, title: "参考图", position: { x: 100, y: 120 }, width: 280, height: 280, metadata: {} }, "recipe-ref-1"),
                node({ type: CanvasNodeType.Text, title: "改图说明", position: { x: 100, y: 440 }, width: 280, height: 140, metadata: { content: "保持构图，改成水彩风格" } }, "recipe-text-2"),
                node({ type: CanvasNodeType.Image, title: "结果", position: { x: 480, y: 220 }, width: 320, height: 320, metadata: {} }, "recipe-image-2"),
            ],
            connections: [connection("recipe-c-2", "recipe-ref-1", "recipe-image-2"), connection("recipe-c-3", "recipe-text-2", "recipe-image-2")],
        }),
    },
    {
        id: "storyboard",
        title: "三分镜草图",
        description: "三个镜头文本 + 图片位，适合分镜起手",
        build: () => ({
            title: "配方：三分镜草图",
            nodes: [1, 2, 3].flatMap((index) => [
                node({ type: CanvasNodeType.Text, title: `镜头 ${index}`, position: { x: 80, y: 80 + (index - 1) * 220 }, width: 260, height: 140, metadata: { content: `镜头${index}：描述场景与人物动作` } }, `recipe-shot-text-${index}`),
                node({ type: CanvasNodeType.Image, title: `画面 ${index}`, position: { x: 420, y: 60 + (index - 1) * 220 }, width: 260, height: 180, metadata: {} }, `recipe-shot-image-${index}`),
            ]),
            connections: [1, 2, 3].map((index) => connection(`recipe-shot-c-${index}`, `recipe-shot-text-${index}`, `recipe-shot-image-${index}`)),
        }),
    },
    {
        id: "prompt-to-video",
        title: "提示词到视频",
        description: "文本连接到视频节点，适合镜头预演",
        build: () => ({
            title: "配方：提示词到视频",
            nodes: [
                node({ type: CanvasNodeType.Text, title: "分镜脚本", position: { x: 120, y: 180 }, width: 300, height: 200, metadata: { content: "清晨城市航拍，镜头缓慢推进，电影感" } }, "recipe-video-text"),
                node({ type: CanvasNodeType.Video, title: "视频", position: { x: 500, y: 160 }, width: 360, height: 240, metadata: {} }, "recipe-video-node"),
            ],
            connections: [connection("recipe-video-c", "recipe-video-text", "recipe-video-node")],
        }),
    },
];
