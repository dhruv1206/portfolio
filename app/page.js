import { personalData } from "@/utils/data/personal-data";
import AboutSection from "./components/homepage/about";
import Blog from "./components/homepage/blog";
import ContactSection from "./components/homepage/contact";
import Education from "./components/homepage/education";
import Experience from "./components/homepage/experience";
import HeroSection from "./components/homepage/hero-section";
import Projects from "./components/homepage/projects";
import Skills from "./components/homepage/skills";

async function getBlogs() {
    try {
        const res = await fetch(
            `https://dev.to/api/articles?username=${personalData.devUsername}`,
            { next: { revalidate: 3600 } } // Revalidate every hour
        );
        if (!res.ok) return [];
        return res.json();
    } catch (error) {
        console.error("Failed to fetch blogs:", error);
        return [];
    }
}

export default async function Home() {
    const blogs = await getBlogs();

    return (
        <>
            <HeroSection />
            <AboutSection />
            <Experience />
            <Skills />
            <Projects />
            <Education />
            <Blog blogs={blogs} />
            <ContactSection />
        </>
    );
}
