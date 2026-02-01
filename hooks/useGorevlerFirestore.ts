"use client";

import { useEffect, useState, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { getFirestoreDb, isFirebaseConfigured } from "@/lib/firebase";

export type StatusKind = "Yapıldı" | "Sürüyor" | "Beklemede" | "İptal";
export type PriorityKind = "High" | "Medium" | "Low";

export type GorevLive = {
  id: string;
  taskName: string;
  status: StatusKind;
  assigneeName: string;
  assigneeInitials: string;
  priority: PriorityKind;
  updatedAt: Date;
  editedBy?: string;
};

const COLLECTION = "gorevler";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "—";
}

function mapDocToGorev(id: string, data: DocumentData): GorevLive {
  const updatedAt = data.updatedAt as Timestamp | undefined;
  return {
    id,
    taskName: String(data.taskName ?? ""),
    status: (data.status as StatusKind) ?? "Beklemede",
    assigneeName: String(data.assigneeName ?? ""),
    assigneeInitials: data.assigneeInitials != null ? String(data.assigneeInitials) : initials(String(data.assigneeName ?? "")),
    priority: (data.priority as PriorityKind) ?? "Medium",
    updatedAt: updatedAt?.toDate?.() ?? new Date(),
    editedBy: data.editedBy != null ? String(data.editedBy) : undefined,
  };
}

export function useGorevlerFirestore() {
  const [tasks, setTasks] = useState<GorevLive[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const enabled = isFirebaseConfigured();

  useEffect(() => {
    if (!enabled) {
      setTasks([]);
      setIsLoading(false);
      setIsLive(false);
      return;
    }

    const db = getFirestoreDb();
    if (!db) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTION),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => mapDocToGorev(d.id, d.data()));
        setTasks(list);
        setIsLoading(false);
        setIsLive(true);
      },
      (err) => {
        console.warn("[GorevlerFirestore] onSnapshot error:", err);
        setIsLoading(false);
        setIsLive(false);
      }
    );

    return () => unsubscribe();
  }, [enabled]);

  const addTask = useCallback(
    async (payload: Omit<GorevLive, "id" | "updatedAt" | "assigneeInitials">) => {
      const db = getFirestoreDb();
      if (!db) throw new Error("Firestore yok");
      const assigneeInitials = initials(payload.assigneeName);
      await addDoc(collection(db, COLLECTION), {
        taskName: payload.taskName,
        status: payload.status,
        assigneeName: payload.assigneeName,
        assigneeInitials,
        priority: payload.priority,
        editedBy: payload.editedBy ?? null,
        updatedAt: serverTimestamp(),
      });
    },
    []
  );

  const updateTask = useCallback(
    async (
      id: string,
      patch: Partial<Pick<GorevLive, "taskName" | "status" | "assigneeName" | "priority" | "editedBy">>
    ) => {
      const db = getFirestoreDb();
      if (!db) throw new Error("Firestore yok");
      const ref = doc(db, COLLECTION, id);
      const data: DocumentData = { ...patch, updatedAt: serverTimestamp() };
      if (patch.assigneeName != null) {
        data.assigneeInitials = initials(patch.assigneeName);
      }
      await updateDoc(ref, data);
    },
    []
  );

  const deleteTask = useCallback(async (id: string) => {
    const db = getFirestoreDb();
    if (!db) throw new Error("Firestore yok");
    await deleteDoc(doc(db, COLLECTION, id));
  }, []);

  return {
    tasks,
    isLoading,
    isLive,
    enabled,
    addTask,
    updateTask,
    deleteTask,
  };
}
