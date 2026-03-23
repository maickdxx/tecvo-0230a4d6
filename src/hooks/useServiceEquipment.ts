import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ServiceEquipmentLocal {
  id: string;
  name: string;
  brand: string;
  model: string;
  serial_number: string;
  conditions: string;
  defects: string;
  solution: string;
  technical_report: string;
  warranty_terms: string;
}

const emptyEquipment = (): ServiceEquipmentLocal => ({
  id: crypto.randomUUID(),
  name: "",
  brand: "",
  model: "",
  serial_number: "",
  conditions: "",
  defects: "",
  solution: "",
  technical_report: "",
  warranty_terms: "",
});

export function useServiceEquipment(serviceId?: string) {
  const [equipment, setEquipment] = useState<ServiceEquipmentLocal[]>([]);
  const { organizationId } = useAuth();

  useEffect(() => {
    if (!serviceId) return;
    supabase
      .from("service_equipment")
      .select("*")
      .eq("service_id", serviceId)
      .order("created_at")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setEquipment(
            data.map((e: any) => ({
              id: e.id,
              name: e.name || "",
              brand: e.brand || "",
              model: e.model || "",
              serial_number: e.serial_number || "",
              conditions: e.conditions || "",
              defects: e.defects || "",
              solution: e.solution || "",
              technical_report: e.technical_report || "",
              warranty_terms: e.warranty_terms || "",
            }))
          );
        }
      });
  }, [serviceId]);

  const addEquipment = () => {
    setEquipment((prev) => [...prev, emptyEquipment()]);
  };

  const removeEquipment = (id: string) => {
    setEquipment((prev) => prev.filter((e) => e.id !== id));
  };

  const updateEquipment = (id: string, field: keyof ServiceEquipmentLocal, value: string) => {
    setEquipment((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  };

  const saveEquipment = async (serviceId: string) => {
    if (!organizationId) return;

    // Delete existing equipment for this service
    await supabase
      .from("service_equipment")
      .delete()
      .eq("service_id", serviceId);

    if (equipment.length === 0) return;

    const rows = equipment.map((e) => ({
      service_id: serviceId,
      organization_id: organizationId,
      name: e.name,
      brand: e.brand,
      model: e.model,
      serial_number: e.serial_number,
      conditions: e.conditions,
      defects: e.defects,
      solution: e.solution,
      technical_report: e.technical_report,
      warranty_terms: e.warranty_terms,
    }));

    await supabase.from("service_equipment").insert(rows);
  };

  return {
    equipment,
    setEquipment,
    addEquipment,
    removeEquipment,
    updateEquipment,
    saveEquipment,
  };
}
