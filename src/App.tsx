import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";

const App = () => (
  <TooltipProvider>
    <Index />
  </TooltipProvider>
);

export default App;
