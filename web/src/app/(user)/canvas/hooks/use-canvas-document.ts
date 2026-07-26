"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { CanvasBackgroundMode } from "@/lib/canvas-theme";
import { useCanvasStore, DEFAULT_CANVAS_SIDE_PANEL, type CanvasSidePanelState } from "../stores/use-canvas-store";
import type { CanvasAssistantSession, CanvasConnection, CanvasNodeData, ViewportTransform } from "../types";

export type CanvasHistoryEntry = {
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    chatSessions: CanvasAssistantSession[];
    activeChatId: string | null;
    backgroundMode: CanvasBackgroundMode;
    showImageInfo: boolean;
};

type HydrateHelpers = {
    hydrateCanvasImages: (nodes: CanvasNodeData[]) => Promise<CanvasNodeData[]>;
    hydrateAssistantImages: (sessions: CanvasAssistantSession[]) => Promise<CanvasAssistantSession[]>;
    resetInterruptedGeneration: (nodes: CanvasNodeData[]) => CanvasNodeData[];
};

/** Owns canvas document state: nodes/connections/sessions + undo history + project load. */
export function useCanvasDocument(projectId: string, helpers: HydrateHelpers) {
    const router = useRouter();
    const hydrated = useCanvasStore((state) => state.hydrated);
    const openProject = useCanvasStore((state) => state.openProject);

    const [nodes, setNodes] = useState<CanvasNodeData[]>([]);
    const [connections, setConnections] = useState<CanvasConnection[]>([]);
    const [chatSessions, setChatSessions] = useState<CanvasAssistantSession[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [backgroundMode, setBackgroundMode] = useState<CanvasBackgroundMode>("lines");
    const [showImageInfo, setShowImageInfo] = useState(false);
    const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, k: 1 });
    const [sidePanel, setSidePanel] = useState<CanvasSidePanelState>(() => DEFAULT_CANVAS_SIDE_PANEL);
    const [projectLoaded, setProjectLoaded] = useState(false);
    const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

    const historyRef = useRef<{ past: CanvasHistoryEntry[]; future: CanvasHistoryEntry[] }>({ past: [], future: [] });
    const lastHistoryRef = useRef<CanvasHistoryEntry | null>(null);
    const historyCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const applyingHistoryRef = useRef(false);
    const historyPausedRef = useRef(false);

    const createHistoryEntry = useCallback(
        (): CanvasHistoryEntry => ({
            nodes,
            connections,
            chatSessions,
            activeChatId,
            backgroundMode,
            showImageInfo,
        }),
        [activeChatId, backgroundMode, chatSessions, connections, nodes, showImageInfo],
    );

    useEffect(() => {
        if (!hydrated) return;
        setProjectLoaded(false);
        const project = openProject(projectId);
        if (!project) {
            router.replace("/canvas");
            return;
        }

        const restore = async () => {
            const restoredNodes = await helpers.hydrateCanvasImages(helpers.resetInterruptedGeneration(project.nodes));
            const restoredSessions = await helpers.hydrateAssistantImages(project.chatSessions || []);
            setNodes(restoredNodes);
            setConnections(project.connections);
            setChatSessions(restoredSessions);
            setActiveChatId(project.activeChatId || null);
            setBackgroundMode(project.backgroundMode);
            setShowImageInfo(project.showImageInfo || false);
            setViewport(project.viewport);
            setSidePanel(project.sidePanel || DEFAULT_CANVAS_SIDE_PANEL);
            historyRef.current = { past: [], future: [] };
            if (historyCommitTimerRef.current) {
                clearTimeout(historyCommitTimerRef.current);
                historyCommitTimerRef.current = null;
            }
            lastHistoryRef.current = {
                nodes: restoredNodes,
                connections: project.connections,
                chatSessions: restoredSessions,
                activeChatId: project.activeChatId || null,
                backgroundMode: project.backgroundMode,
                showImageInfo: project.showImageInfo || false,
            };
            setHistoryState({ canUndo: false, canRedo: false });
            setProjectLoaded(true);
        };
        void restore();
        // helpers intentionally omitted to avoid reload loops
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hydrated, openProject, projectId, router]);

    useEffect(() => {
        if (!projectLoaded || applyingHistoryRef.current || historyPausedRef.current) return;
        const next = createHistoryEntry();
        const previous = lastHistoryRef.current;
        if (
            previous?.nodes === next.nodes &&
            previous.connections === next.connections &&
            previous.chatSessions === next.chatSessions &&
            previous.activeChatId === next.activeChatId &&
            previous.backgroundMode === next.backgroundMode &&
            previous.showImageInfo === next.showImageInfo
        ) {
            return;
        }

        if (historyCommitTimerRef.current) clearTimeout(historyCommitTimerRef.current);
        historyCommitTimerRef.current = setTimeout(() => {
            const current = createHistoryEntry();
            const last = lastHistoryRef.current;
            if (!last) return;
            historyRef.current.past = [...historyRef.current.past.slice(-49), last];
            historyRef.current.future = [];
            setHistoryState({ canUndo: true, canRedo: false });
            lastHistoryRef.current = current;
            historyCommitTimerRef.current = null;
        }, 180);

        return () => {
            if (historyCommitTimerRef.current) {
                clearTimeout(historyCommitTimerRef.current);
                historyCommitTimerRef.current = null;
            }
        };
    }, [createHistoryEntry, projectLoaded]);

    const applyHistoryEntry = useCallback((entry: CanvasHistoryEntry) => {
        applyingHistoryRef.current = true;
        setNodes(entry.nodes);
        setConnections(entry.connections);
        setChatSessions(entry.chatSessions);
        setActiveChatId(entry.activeChatId);
        setBackgroundMode(entry.backgroundMode);
        setShowImageInfo(entry.showImageInfo);
        lastHistoryRef.current = entry;
        queueMicrotask(() => {
            applyingHistoryRef.current = false;
        });
    }, []);

    const undoCanvas = useCallback(() => {
        const previous = historyRef.current.past.pop();
        if (!previous) return;
        const current = createHistoryEntry();
        historyRef.current.future.push(current);
        applyHistoryEntry(previous);
        setHistoryState({ canUndo: historyRef.current.past.length > 0, canRedo: historyRef.current.future.length > 0 });
    }, [applyHistoryEntry, createHistoryEntry]);

    const redoCanvas = useCallback(() => {
        const next = historyRef.current.future.pop();
        if (!next) return;
        const current = createHistoryEntry();
        historyRef.current.past.push(current);
        applyHistoryEntry(next);
        setHistoryState({ canUndo: historyRef.current.past.length > 0, canRedo: historyRef.current.future.length > 0 });
    }, [applyHistoryEntry, createHistoryEntry]);

    return {
        nodes,
        setNodes,
        connections,
        setConnections,
        chatSessions,
        setChatSessions,
        activeChatId,
        setActiveChatId,
        backgroundMode,
        setBackgroundMode,
        showImageInfo,
        setShowImageInfo,
        viewport,
        setViewport,
        sidePanel,
        setSidePanel,
        projectLoaded,
        historyState,
        historyRef,
        lastHistoryRef,
        historyPausedRef,
        applyingHistoryRef,
        createHistoryEntry,
        undoCanvas,
        redoCanvas,
    };
}

export type CanvasDocumentState = ReturnType<typeof useCanvasDocument>;
