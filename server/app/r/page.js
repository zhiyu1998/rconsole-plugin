import Sidebar from "../../components/sidebar.jsx";
import Header from "../../components/header.jsx";
import { DrawerProvider } from "../../contexts/drawer-context.js";

export default function Page() {
    return (
        <DrawerProvider>
            <Header/>
            <Sidebar />
        </DrawerProvider>
    )
}
