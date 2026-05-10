/** UI + istemci için proje sohbet mesajı (DB satırından türetilir) */
export type ProjectChatMessage = {
  id: string;
  projectId: string;
  email?: string;
  name?: string;
  text: string;
  /** created_at (ms) */
  at: number;
};
