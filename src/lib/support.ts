/** Contato do suporte (WhatsApp configurado no ambiente ou e-mail padrão). */
export const supportHref =
  (import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined) || "mailto:origemconecta@gmail.com";
