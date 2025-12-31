export const projectsData = [
    {
        id: 1,
        slug: "dstardb",
        name: "DStarDB",
        description:
            "Built DStarDB, a C++ multithreaded in-memory database optimized for multi-core performance and clean architecture. Implements Redis-style types (strings, hashes, lists, sets, sorted sets, streams with consumer groups), transactions, TTL/LFU eviction, snapshot persistence, and a shared thread-pool event loop. Benchmarks show lower tail latency and improved throughput vs Redis.",
        challenge:
            "Redis is single-threaded by design, which limits throughput on modern multi-core systems. The challenge was to build a concurrent in-memory database that maintains Redis compatibility while significantly improving multi-threaded performance.",
        solution:
            "Implemented a shared thread-pool event loop architecture with lock-free data structures where possible. Used fine-grained locking for complex operations and developed a clean layered architecture separating networking, command parsing, and storage layers.",
        tools: ["C++", "CMake", "std::thread / pthread"],
        role: "Backend Developer",
        code: "https://github.com/dhruv1206/DStar-DB",
        demo: "",
        image: "",
        url: "https://github.com/dhruv1206/DStar-DB",
        gallery: [],
        video: "",
        accentColor: "#8b5cf6",
    },
    {
        id: 2,
        slug: "realtime-collaboration",
        name: "Real-Time Collaboration Platform",
        description:
            "Developed a robust meeting system using Spring Boot, WebSockets, and WebRTC, enabling real-time chat, audio, and video communication with minimal latency. Architected core microservices like Config Server, Eureka Discovery Server, Gateway Server, and Meet Signalling Server, ensuring scalable, low-latency, and high-performance communication.",
        challenge:
            "Building real-time communication at scale requires handling thousands of concurrent connections while maintaining sub-100ms latency for audio/video streams.",
        solution:
            "Designed a microservices architecture with Eureka for service discovery, a custom signaling server for WebRTC negotiation, and optimized WebSocket handling for chat. Used selective forwarding units (SFU) pattern for scalable video routing.",
        tools: [
            "Spring Boot",
            "WebSockets",
            "WebRTC",
            "Microservices",
            "Gateway Server",
            "Eureka Discovery",
        ],
        role: "Backend Developer",
        code: "",
        demo: "",
        image: "",
        url: "https://github.com/dhruv1206/MEET-MICROSERVICES",
        gallery: [],
        video: "",
        accentColor: "#06b6d4",
    },
    {
        id: 3,
        slug: "ai-press-release-generator",
        name: "AI-Enhanced Multilingual Press Release Generator",
        description:
            "Crafted an AI-powered tool using Flask and Python to transform PIB press releases into engaging multilingual videos, increasing accessibility. Established a centralized image management system and advanced prompt engineering to streamline video creation workflows, cutting production time by 45% and boosting productivity by 35%.",
        challenge:
            "Government press releases are text-heavy and inaccessible to many citizens. Creating multilingual video content manually was time-consuming and expensive.",
        solution:
            "Built an end-to-end pipeline using AI for translation, text-to-speech, and automated video generation. Implemented smart caching for images and created reusable templates for consistent branding.",
        tools: [
            "Flask",
            "Python",
            "AI",
            "Prompt Engineering",
            "Image Management",
        ],
        role: "Backend Developer",
        code: "",
        demo: "",
        image: "",
        url: "https://github.com/dhruv1206/synth-ai-envoys",
        gallery: [],
        video: "",
        accentColor: "#f472b6",
    },
    {
        id: 4,
        slug: "college-attendance-app",
        name: "College Attendance App",
        description:
            "Developed and deployed a Flutter frontend and Node.js backend application on DigitalOcean for tracking college attendance. Implemented web scraping for real-time data acquisition, Firebase services for analytics and notifications, and WorkManager for local notifications. The app achieved over 3.5k downloads on Google Play Store within 2-3 months, with a monthly growth rate of 236%.",
        challenge:
            "Students had no easy way to track their attendance, often leading to shortfalls and exam debarments. The college system was only accessible via a complex web portal.",
        solution:
            "Reverse-engineered the college's attendance API and built a mobile-first experience with push notifications for low attendance warnings. Used WorkManager for reliable background syncs even when the app was closed.",
        tools: [
            "Flutter",
            "Node.js",
            "Firebase",
            "WorkManager",
            "DigitalOcean",
        ],
        role: "Full Stack Developer",
        code: "",
        demo: "",
        image: "",
        url: "https://play.google.com/store/apps/details?id=com.dhruvdev.lnct_attendance&hl=en",
        gallery: [],
        video: "",
        accentColor: "#22c55e",
    },
    {
        id: 5,
        slug: "amazon-clone",
        name: "Amazon Clone App",
        description:
            "Developed a feature-rich Amazon Clone mobile app with search, categories, cart management, and secure checkout using GPay and ApplePay. Implemented an admin panel for efficient product management, including the ability to add products, monitor sales performance, and track category-wise sales. Integrated Flutter frontend with NodeJS, ExpressJS, and MongoDB backend for seamless data communication, resulting in a reliable and scalable solution.",
        challenge:
            "Building a full e-commerce experience requires handling complex state management, payment integration, and real-time inventory updates across multiple platforms.",
        solution:
            "Used Riverpod for state management, integrated native payment SDKs for GPay/ApplePay, and designed a RESTful API with proper authentication. The admin panel provides real-time analytics dashboards.",
        tools: [
            "Flutter",
            "NodeJS",
            "ExpressJS",
            "MongoDB",
            "GPay",
            "ApplePay",
        ],
        role: "Full Stack Developer",
        code: "",
        demo: "",
        image: "",
        url: "https://github.com/dhruv1206/flutter_amazon_clone",
        gallery: [],
        video: "",
        accentColor: "#f59e0b",
    },
    {
        id: 6,
        slug: "whatsapp-clone",
        name: "WhatsApp Clone App",
        description:
            "Developed a full-stack WhatsApp Clone app using Flutter, Firebase, and Riverpod 2.0, incorporating phone number authentication, one-to-one and group chatting, support for various media types, emoji sharing, image and video caching. Implemented additional features like status updates, video calling, online/offline status indication, message seen feature, and automatic scrolling.",
        challenge:
            "Replicating WhatsApp's real-time messaging experience requires handling complex features like live typing indicators, read receipts, and efficient media caching.",
        solution:
            "Leveraged Firebase Realtime Database for instant message delivery, Cloud Functions for push notifications, and custom caching strategies for media. Video calling was implemented using WebRTC with Firebase as the signaling server.",
        tools: [
            "Flutter",
            "Firebase",
            "Riverpod 2.0",
            "Video Calling",
            "Authentication",
        ],
        role: "Full Stack Developer",
        code: "",
        demo: "",
        image: "",
        url: "https://github.com/dhruv1206/flutter_whatsapp_clone",
        gallery: [],
        video: "",
        accentColor: "#10b981",
    },
];

// Helper function to get project by slug
export const getProjectBySlug = (slug) => {
    return projectsData.find((project) => project.slug === slug);
};

// Get all slugs for static generation
export const getAllProjectSlugs = () => {
    return projectsData.map((project) => project.slug);
};
