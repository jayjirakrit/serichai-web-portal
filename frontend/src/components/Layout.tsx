import Navbar from "@/components/Navbar";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        {children}
      </main>
      {/* <Footer /> */}
    </div>
  );
}

export default Layout;
