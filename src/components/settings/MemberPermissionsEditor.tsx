import { useEffect } from "react";
import { Shield, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { PERMISSION_CATEGORIES } from "@/lib/permissionsConfig";
import type { AppRole } from "@/hooks/useUserRole";

interface MemberPermissionsEditorProps {
  userId: string;
  organizationId: string;
  memberRole: AppRole;
}

export function MemberPermissionsEditor({
  userId,
  organizationId,
  memberRole,
}: MemberPermissionsEditorProps) {
  const {
    permissions,
    setPermissions,
    isLoading,
    isSaving,
    loadPermissions,
    savePermissions,
    applyPreset,
  } = useMemberPermissions();

  useEffect(() => {
    if (userId && organizationId) {
      loadPermissions(userId);
    }
  }, [userId, organizationId, loadPermissions]);

  const togglePermission = (key: string) => {
    setPermissions(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  const handleSave = () => {
    savePermissions(userId, permissions);
  };

  const handleResetToDefault = () => {
    applyPreset(memberRole);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="mt-3 border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Permissões do usuário
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetToDefault}
            className="text-xs text-muted-foreground"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Restaurar padrão
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {PERMISSION_CATEGORIES.map((category, catIdx) => (
          <div key={category.key}>
            {catIdx > 0 && <Separator className="mb-4" />}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {category.label}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {category.permissions.map(perm => (
                <label
                  key={perm.key}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm">{perm.label}</span>
                  <Switch
                    checked={permissions.includes(perm.key)}
                    onCheckedChange={() => togglePermission(perm.key)}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar permissões"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
