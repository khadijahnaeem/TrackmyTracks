import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import TrendingTracks from "./components/TrendingTracks";
import FreshReviews from "./components/FreshReviews";
import Footer from "./components/Footer";

function App() {
  return (
    <>
      <Navbar />

      <main>
        <Hero />
        <TrendingTracks />
        <FreshReviews />
      </main>

      <Footer />
    </>
  );
}

export default App;