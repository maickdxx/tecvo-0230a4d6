import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export interface WhatsAppTag {
  id: string;
  name: string;
  color: string;
}

const TAG_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  emerald: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
  amber: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
  purple: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
  red: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
  pink: { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-700 dark:text-pink-300", border: "border-pink-200 dark:border-pink-800" },
  orange: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
  teal: { bg: "bg-teal-100 dark:bg-teal-900/30", text: "text-teal-700 dark:text-teal-300", border: "border-teal-200 dark:border-teal-800" },
  indigo: { bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800" },
  gray: { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" },
};

const DEFAULT_COLOR_STYLE = { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" };

export const AVAILABLE_TAG_COLORS = Object.keys(TAG_COLOR_MAP);

export function getTagColorStyle(color: string) {
  return TAG_COLOR_MAP[color] || DEFAULT_COLOR_STYLE;
}

export function useWhatsAppTags() {
  const { organization } = useOrganization();
  const [tags, setTags] = useState<WhatsAppTag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    if (!organization?.id) return;
    const { data } = await supabase
      .from("whatsapp_tags")
      .select("id, name, color")
      .eq("organization_id", organization.id)
      .order("name");
    setTags((data as WhatsAppTag[]) || []);
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const createTag = useCallback(async (name: string, color: string) => {
    if (!organization?.id) return null;
    const { data, error } = await supabase
      .from("whatsapp_tags")
      .insert({ organization_id: organization.id, name: name.trim(), color })
      .select("id, name, color")
      .single();
    if (error) return null;
    const tag = data as WhatsAppTag;
    setTags(prev => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
    return tag;
  }, [organization?.id]);

  const updateTag = useCallback(async (id: string, name: string, color: string) => {
    const { error } = await supabase
      .from("whatsapp_tags")
      .update({ name: name.trim(), color })
      .eq("id", id);
    if (error) return false;
    setTags(prev => prev.map(t => t.id === id ? { ...t, name: name.trim(), color } : t));
    return true;
  }, []);

  const deleteTag = useCallback(async (tag: WhatsAppTag) => {
    if (!organization?.id) return;
    // Remove from all contacts that have this tag name
    const { data: contacts } = await supabase
      .from("whatsapp_contacts")
      .select("id, tags")
      .eq("organization_id", organization.id)
      .contains("tags", [tag.name]);
    
    if (contacts) {
      for (const c of contacts) {
        const updated = ((c.tags as string[]) || []).filter((t: string) => t !== tag.name);
        await supabase.from("whatsapp_contacts").update({ tags: updated }).eq("id", c.id);
      }
    }

    await supabase.from("whatsapp_tags").delete().eq("id", tag.id);
    setTags(prev => prev.filter(t => t.id !== tag.id));
  }, [organization?.id]);

  const getTagByName = useCallback((name: string) => {
    return tags.find(t => t.name === name);
  }, [tags]);

  return { tags, loading, createTag, updateTag, deleteTag, getTagByName, refetch: fetchTags };
}
