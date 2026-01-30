import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function HomePage() {
  // El middleware maneja la redirección automáticamente
  // Esta página solo se muestra brevemente durante la transición
  return (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner text="Redirigiendo..." />
    </div>
  );
}
