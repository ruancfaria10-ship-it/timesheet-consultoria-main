// src/components/UpdatePassword.tsx
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock } from "lucide-react";

export function UpdatePassword({ onUpdateSuccess }: { onUpdateSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("A senha deve ter no mínimo 6 caracteres.");
    
    setLoading(true);

    // Atualiza a senha do usuário autenticado no Supabase
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      toast.error("Erro ao salvar a senha: " + error.message);
    } else {
      toast.success("Senha cadastrada com sucesso!");
      onUpdateSuccess();
    }
    
    setLoading(false);
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
        <form onSubmit={handleUpdate} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="new-password">Crie uma Senha</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full h-12 text-md" disabled={loading}>
            {loading ? "Salvando..." : "Salvar e Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}