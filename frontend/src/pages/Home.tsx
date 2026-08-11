import Layout from "../components/Layout";
import Card from "../components/Card";

function Home() {
  return (
    <Layout>
      <div className="h-screen bg-surface-bright">
        <div className="home-title flex flex-col justify-center p-8">
          <h6 className="text-primary pb-2">Home</h6>
          <h3 className="bold">Welcome to Serichai Web Portal</h3>
        </div>

        <div className="home-content grid grid-cols-4 gap-6 p-8">
          <Card />
          <Card />
          <Card />
        </div>
      </div>
    </Layout>
  );
}
export default Home;
