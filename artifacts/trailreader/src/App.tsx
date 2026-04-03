import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider, useApp } from "@/context/AppContext";
import { ReaderPage } from "@/pages/ReaderPage";
import { UploadPage } from "@/pages/UploadPage";
import { SettingsPage } from "@/pages/SettingsPage";

const queryClient = new QueryClient();

function Home() {
  const { book } = useApp();
  return book ? <ReaderPage /> : <UploadPage />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/settings" component={SettingsPage} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
