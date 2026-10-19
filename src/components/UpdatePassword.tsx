// src/components/UpdatePassword.tsx
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, User, PlusCircle, Loader2 } from "lucide-react";

const compressAvatarImage = (file: File, maxSize: number = 300): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height *= maxSize / width;
          width = maxSize;
        } else if (height > maxSize) {
          width *= maxSize / height;
          height = maxSize;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject("Erro na compressão")), "image/webp", 0.8);
      };
    };
  });
};

export function UpdatePassword({ onUpdateSuccess }: { onUpdateSuccess: () => void }) {
  const [nome, setNome] = useState("");
  const [password, setPassword] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data } = await supabase.from("consultores").select("nome, avatar_url").eq("id", user.id).single();
        if (data?.nome) setNome(data.nome);
        if (data?.avatar_url) setAvatarPreview(data.avatar_url);
      }
    });
  }, []);

  const handleSelectPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return toast.error("Por favor, preencha o seu nome completo.");
    if (password.length < 6) return toast.error("A senha deve ter no mínimo 6 caracteres.");
    
    setLoading(true);

    try {
      const { data: userData, error: passError } = await supabase.auth.updateUser({
        password: password,
      });
      if (passError) throw passError;

      const userId = userData.user?.id;
      if (userId) {
        let finalAvatarUrl = avatarPreview;

        if (avatarFile) {
          const compressedBlob = await compressAvatarImage(avatarFile, 300);
          const fileName = `${userId}-${Math.random().toString(36).substring(2)}.webp`;
          const { error: uploadError } = await supabase.storage.from("avatares").upload(fileName, compressedBlob, {
            contentType: "image/webp",
          });
          if (!uploadError) {
            const { data: pubUrl } = supabase.storage.from("avatares").getPublicUrl(fileName);
            finalAvatarUrl = pubUrl.publicUrl;
          }
        }

        const { data: existing } = await supabase.from("consultores").select("id").eq("id", userId).maybeSingle();
        if (existing) {
          await supabase.from("consultores").update({
            nome: nome.trim(),
            ...(finalAvatarUrl ? { avatar_url: finalAvatarUrl } : {}),
          }).eq("id", userId);
        } else {
          await supabase.from("consultores").insert([{
            id: userId,
            nome: nome.trim(),
            avatar_url: finalAvatarUrl || null,
            status_ativo: true,
            is_convidado: false,
            horas_minimas_mes: 0,
          }]);
        }
      }

      toast.success("Perfil e senha configurados com sucesso!");
      onUpdateSuccess();
    } catch (error: any) {
      toast.error("Erro ao concluir cadastro: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-999 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border bg-card p-8 shadow-xl">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Bem-vindo(a) à Engeprice!</h1>
          <p className="text-sm text-muted-foreground">
            Para acessar o Timesheet, crie sua senha de acesso abaixo.
          </p>
        </div>
        <form onSubmit={handleUpdate} className="space-y-5">
          {/* UPLOAD DE FOTO DE PERFIL (OPCIONAL) */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative group cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleSelectPhoto}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                title="Clique para enviar uma foto de perfil"
              />
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Pré-visualização do Avatar"
                  className="w-20 h-20 rounded-full border-2 border-primary/30 object-cover shadow-sm group-hover:opacity-60 transition-opacity"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-dashed border-primary/30 flex items-center justify-center text-primary font-bold text-xl group-hover:bg-primary/20 transition-colors">
                  {nome.trim() ? nome.trim().substring(0, 2).toUpperCase() : <User className="w-8 h-8 opacity-60" />}
                </div>
              )}
              <div className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1 shadow-md pointer-events-none">
                <PlusCircle className="w-4 h-4" />
              </div>
            </div>
            <span className="text-[11px] text-muted-foreground">Foto de perfil (opcional)</span>
          </div>

          {/* NOME COMPLETO DO CONSULTOR */}
          <div className="space-y-2">
            <Label htmlFor="consultor-nome">Seu Nome Completo</Label>
            <Input
              id="consultor-nome"
              type="text"
              placeholder="Ex: Ruan Cardoso Faria"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* SENHA DE ACESSO */}
          <div className="space-y-2">
            <Label htmlFor="new-password">Crie uma Senha de Acesso</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full h-12 text-md gap-2" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Salvando Perfil..." : "Concluir Cadastro e Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}