import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Timer, ArrowLeft } from "lucide-react";

export function Login({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Controle para alternar entre a tela de Login e a tela de Recuperação
  const [isResetting, setIsResetting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error("Erro ao entrar: Verifique seu e-mail e senha.");
    } else {
      toast.success("Login realizado com sucesso!");
      onLoginSuccess();
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Por favor, digite seu e-mail.");
    
    setLoading(true);
    
    // Dispara o e-mail de redefinição oficial do Supabase
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://timesheet.engeprice.workers.dev/',
    });

    if (error) {
      toast.error("Erro ao enviar e-mail de recuperação.");
    } else {
      toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
      setIsResetting(false); // Volta para a tela de login
      setPassword(""); // Limpa a senha por segurança
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Timer className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Timesheet Engeprice</h1>
          <p className="text-sm text-muted-foreground">
            {isResetting ? "Recuperação de senha" : "Faça login para apontar suas horas"}
          </p>
        </div>

        {isResetting ? (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email corporativo</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="seuemail@engeprice.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-3">
              <Button type="submit" className="w-full h-12 text-md" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link de redefinição"}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full" 
                onClick={() => setIsResetting(false)}
                disabled={loading}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para o login
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seuemail@engeprice.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <button 
                  type="button" 
                  className="text-[11px] font-medium text-primary hover:underline focus:outline-none"
                  onClick={() => setIsResetting(true)}
                >
                  Esqueceu a senha?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full h-12 text-md" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}