import Layout from "@/components/Layout";
import Card from "@/components/Card";

type FeatureProps = {
  title: string;
  description: string;
  link: string;
};

function Home() {
  const features: FeatureProps[] = [
    {
      title: "Employee Benefits",
      description: "Comprehensive benefits package for all employees.",
      link: "/employee-benefits",
    },
    {
      title: "Bonus Calculation",
      description: "Calculate your bonus based on performance metrics.",
      link: "/bonus-calculation",
    },
  ];

  return (
    <Layout>
      <div className="h-screen bg-surface-bright">
        <div className="home-title flex flex-col justify-center p-8">
          <h6 className="text-primary pb-2">Home</h6>
          <h3 className="bold">Welcome to Serichai Web Portal</h3>
        </div>

        <div className="home-content grid grid-cols-4 gap-6 p-8">
          {features.map((feature, index) => (
            <Card
              key={index}
              title={feature.title}
              description={feature.description}
              link={feature.link}
            />
          ))}
        </div>
      </div>
    </Layout>
  );
}
export default Home;
