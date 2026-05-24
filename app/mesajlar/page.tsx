"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, MessageCircle, MessagesSquare, Shield, Search } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useProjects } from "@/hooks/useProjects";
import { useProjectChatUnread } from "@/contexts/project-chat-unread-context";
import { useProjectChatRoom } from "@/hooks/useProjectChatRoom";
import { ProjectChatPanel } from "@/components/ProjectChatPanel";
import { canAccessProjectChat } from "@/lib/projectAccess";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

function MesajlarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAdmin, hasPermission } = useAuth();
  const { projects, isLoading } = useProjects();
  const { unreadByProjectId, refresh: refreshChatUnread } = useProjectChatUnread();
  const [search, setSearch] = useState("");

  const email = (user?.email ?? "").trim().toLowerCase();
  const canSee = hasPermission("area.projects") && hasPermission("projects.view");

  const visibleProjects = useMemo(() => {
    const list = projects.filter((p) => {
      if (isAdmin) return true;
      const assigned = p.assigned_emails ?? [];
      return assigned.some((a) => String(a).trim().toLowerCase() === email);
    });
    return [...list].sort((a, b) => {
      const ua = unreadByProjectId[a.id] ?? 0;
      const ub = unreadByProjectId[b.id] ?? 0;
      if (ub !== ua) return ub - ua;
      return a.name.localeCompare(b.name, "tr");
    });
  }, [projects, isAdmin, email, unreadByProjectId]);

  /** Sidebar arama — proje adıyla filtrele (Türkçe-uyumlu, accent-tolerant). */
  const filteredProjects = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    if (!q) return visibleProjects;
    return visibleProjects.filter((p) => p.name.toLocaleLowerCase("tr").includes(q));
  }, [visibleProjects, search]);

  const pParam = searchParams.get("p") ?? "";
  const selected = useMemo(
    () => (pParam ? visibleProjects.find((x) => x.id === pParam) ?? null : null),
    [pParam, visibleProjects]
  );

  useEffect(() => {
    if (isLoading || visibleProjects.length === 0) return;
    if (selected) return;
    const first =
      visibleProjects.find((pr) => (unreadByProjectId[pr.id] ?? 0) > 0) ?? visibleProjects[0];
    router.replace(`/mesajlar?p=${encodeURIComponent(first.id)}`);
  }, [isLoading, visibleProjects, selected, router, unreadByProjectId]);

  const canChat = selected ? canAccessProjectChat(selected, user?.email, isAdmin) : false;

  const { chatMessages, sendChatMessage, chatReady } = useProjectChatRoom({
    projectId: selected?.id ?? "",
    enabled: canChat && !!selected?.id,
    userEmail: user?.email,
    userName: user?.displayName ?? user?.email,
    onAfterMarkRead: refreshChatUnread,
  });

  const selectProject = useCallback(
    (id: string) => {
      router.push(`/mesajlar?p=${encodeURIComponent(id)}`);
    },
    [router]
  );

  if (!canSee) {
    return (
      <div className="container max-w-2xl py-16">
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-8 text-center">
          <Shield className="h-12 w-12 mx-auto text-amber-600 dark:text-amber-400 mb-3" aria-hidden />
          <p className="text-slate-800 dark:text-slate-200 font-medium">Mesajlara erişim yetkiniz yok.</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Projeleri görüntüleme yetkisi gerekir.</p>
          <Button variant="outline" asChild className="mt-4">
            <Link href="/">Dashboard&apos;a dön</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container max-w-6xl py-10">
        <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>
      </div>
    );
  }

  if (visibleProjects.length === 0) {
    return (
      <div className="container max-w-3xl py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Mesajlar</h1>
        </header>
        <EmptyState
          icon={<MessagesSquare className="h-10 w-10" />}
          title="Henüz proje sohbetiniz yok"
          description="Proje sohbetleri burada listelenir. Bir projeye atandıktan sonra ekip üyeleriyle gerçek zamanlı mesajlaşabilirsiniz."
          action={
            <Button asChild>
              <Link href="/projeler">Projelere git</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const totalUnread = visibleProjects.reduce((s, pr) => s + (unreadByProjectId[pr.id] ?? 0), 0);

  return (
    <div className="container max-w-6xl py-6 min-h-[min(100dvh,48rem)]">
      <header className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Mesajlar</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Proje sohbetleriniz. Okunmamışlar üstte; istediğiniz projede cevap yazabilirsiniz.
            {totalUnread > 0 && (
              <span className="ml-1 font-medium text-blue-700 dark:text-blue-300">
                ({totalUnread} okunmamış)
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/projeler">Tüm projeler</Link>
        </Button>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <nav
          className="lg:w-[min(100%,300px)] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/80"
          aria-label="Proje sohbetleri"
        >
          <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-600">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Projeler
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {filteredProjects.length}
                {filteredProjects.length !== visibleProjects.length && ` / ${visibleProjects.length}`}
              </span>
            </div>
            <div className="relative mt-2">
              <Search
                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                aria-hidden
              />
              <input
                type="search"
                placeholder="Proje ara…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 py-1 pl-7 pr-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
                aria-label="Proje ara"
              />
            </div>
          </div>
          {filteredProjects.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
              {search.trim() ? `"${search}" için proje bulunamadı` : "Proje yok"}
            </p>
          ) : (
            <ul className="max-h-[50vh] overflow-y-auto lg:max-h-[min(70vh,36rem)]">
              {filteredProjects.map((pr) => {
                const n = unreadByProjectId[pr.id] ?? 0;
                const active = selected?.id === pr.id;
                return (
                  <li key={pr.id}>
                    <button
                      type="button"
                      onClick={() => selectProject(pr.id)}
                      className={cn(
                        "flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 dark:border-slate-700/80",
                        active
                          ? "bg-blue-50 font-medium text-blue-900 dark:bg-blue-950/40 dark:text-blue-100"
                          : "text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/50",
                        n > 0 && !active && "font-medium"
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{pr.name}</span>
                      {n > 0 && (
                        <span
                          className={cn(
                            "inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none text-white",
                            active ? "bg-blue-700 dark:bg-blue-500" : "bg-blue-600 dark:bg-blue-600"
                          )}
                        >
                          {n > 99 ? "99+" : n}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        <section className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/80">
          {selected && (
            <>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-700">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selected.name}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Bu projedeki ekip ile aynı sohbet; proje sayfasındaki panel ile senkron.
                  </p>
                  <p className="mt-0.5 text-[0.7rem] text-slate-400 dark:text-slate-500">
                    Sohbet açıldığında mesajlar otomatik okundu sayılır.
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/projeler/${selected.id}`} className="gap-1.5">
                    Proje detayı
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </Button>
              </div>
              {!canChat ? (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Bu proje sohbetine erişim koşulları karşılanmıyor (atama gerekli olabilir).
                </p>
              ) : (
                <ProjectChatPanel
                  messages={chatMessages}
                  onSend={sendChatMessage}
                  currentUserEmail={user?.email ?? ""}
                  chatReady={chatReady}
                  className="mt-0"
                  heading="Sohbet"
                  hint="Mesajlar kaydedilir; Enter ile gönderin."
                  messagesContainerClassName="max-h-[min(55vh,28rem)] min-h-[8rem] overflow-y-auto px-3 py-2 space-y-2"
                />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default function MesajlarPage() {
  return (
    <Suspense
      fallback={
        <div className="container max-w-6xl py-10">
          <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>
        </div>
      }
    >
      <MesajlarContent />
    </Suspense>
  );
}
