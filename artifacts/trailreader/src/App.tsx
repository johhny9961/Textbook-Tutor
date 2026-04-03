import { Switch, Route, Router as WouterRouter } from "wouter";
import { AppProvider, useApp } from "@/context/AppContext";
import { ReaderPage } from "@/pages/ReaderPage";
import { UploadPage } from "@/pages/UploadPage";
import { SettingsPage } from "@/pages/SettingsPage";

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
    <AppProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </AppProvider>
  );
}

export default App;
