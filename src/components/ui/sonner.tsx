import { CircleAlert, CircleCheck, Info } from "@/components/mobile/icons";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Aviso no formato do Figma (faixa verde-escura acima da tabbar, ação em verde-folha).
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="bottom-center"
      offset={{ bottom: 104 }}
      mobileOffset={{ bottom: 104, left: 20, right: 20 }}
      gap={10}
      icons={{
        success: <CircleCheck className="lucide" />,
        info: <Info className="lucide" />,
        error: <CircleAlert className="lucide" />,
        warning: <CircleAlert className="lucide" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "m-sonner",
          error: "m-sonner-error",
          warning: "m-sonner-error",
          actionButton: "m-sonner-action",
          cancelButton: "m-sonner-action",
          description: "m-sonner-desc",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
