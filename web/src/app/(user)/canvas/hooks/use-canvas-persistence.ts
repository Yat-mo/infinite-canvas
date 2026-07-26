"use client";

import { useEffect, useRef } from "react";

import type { CanvasBackgroundMode } from "@/lib/canvas-theme";
import { useCanvasStore, type CanvasSidePanelState } from "../stores/use-canvas-store";
import type { CanvasAssistantSession, CanvasConnection, CanvasNodeData, ViewportTransform } from "../types";

type DocumentSlice = {
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    chatSessions: CanvasAssistantSession[];
    activeChatId: string | null;
    backgroundMode: CanvasBackgroundMode;
    showImageInfo: boolean;
    viewport: ViewportTransform;
    sidePanel: CanvasSidePanelState;
};

/** Persists document/viewport/sidePanel changes into the canvas store (and remote sync). */
export function useCanvasPersistence(projectId: string, projectLoaded: boolean, historyPaused: boolean, doc: DocumentSlice) {
    const updateProject = useCanvasStore((state) => state.updateProject);
    const viewportRef = useRef(doc.viewport);
    const viewportSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sidePanelSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        viewportRef.current = doc.viewport;
    }, [doc.viewport]);

    useEffect(() => {
        if (!projectLoaded || historyPaused) return;
        updateProject(projectId, {
            nodes: doc.nodes,
            connections: doc.connections,
            chatSessions: doc.chatSessions,
            activeChatId: doc.activeChatId,
            backgroundMode: doc.backgroundMode,
            showImageInfo: doc.showImageInfo,
        });
    }, [
        doc.activeChatId,
        doc.backgroundMode,
        doc.chatSessions,
        doc.connections,
        doc.nodes,
        doc.showImageInfo,
        historyPaused,
        projectId,
        projectLoaded,
        updateProject,
    ]);

    useEffect(() => {
        if (!projectLoaded) return;
        if (viewportSaveTimerRef.current) clearTimeout(viewportSaveTimerRef.current);
        viewportSaveTimerRef.current = setTimeout(() => {
            updateProject(projectId, { viewport: viewportRef.current });
            viewportSaveTimerRef.current = null;
        }, 250);
        return () => {
            if (viewportSaveTimerRef.current) {
                clearTimeout(viewportSaveTimerRef.current);
                viewportSaveTimerRef.current = null;
            }
        };
    }, [doc.viewport, projectId, projectLoaded, updateProject]);

    useEffect(() => {
        if (!projectLoaded) return;
        if (sidePanelSaveTimerRef.current) clearTimeout(sidePanelSaveTimerRef.current);
        sidePanelSaveTimerRef.current = setTimeout(() => {
            updateProject(projectId, { sidePanel: doc.sidePanel });
            sidePanelSaveTimerRef.current = null;
        }, 250);
        return () => {
            if (sidePanelSaveTimerRef.current) {
                clearTimeout(sidePanelSaveTimerRef.current);
                sidePanelSaveTimerRef.current = null;
            }
        };
    }, [doc.sidePanel, projectId, projectLoaded, updateProject]);
}
