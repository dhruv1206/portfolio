"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { skillsData } from "@/utils/data/skills";
import { skillsImage } from "@/utils/skill-image";
import { FadeIn } from "../../ui/page-transition";

// Categorize skills
const skillCategories = {
  Languages: ["Java", "Kotlin", "Python", "Go", "TypeScript"],
  Frontend: ["React", "Next JS", "Flutter"],
  Backend: ["Node", "SpringBoot", "Flask", "Microservices"],
  Databases: ["SQL", "MySQL", "PostgreSQL", "MongoDB", "ElasticSearch"],
  "Cloud & DevOps": ["AWS", "GCP", "Firebase", "Docker", "GitHub", "Nginx"],
  "APIs & Communication": ["WebSockets", "WebRTC", "Pub/Sub", "Slack API"],
  "AI/ML": ["Machine Learning", "TensorFlow"],
};

const SkillBadge = ({ skill, index }) => {
  const skillImage = skillsImage(skill);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileHover={{ scale: 1.05, y: -5 }}
      className="group"
    >
      <div className="glass-card p-4 flex flex-col items-center gap-3 min-w-[100px]">
        {/* Icon */}
        <div className="w-10 h-10 relative">
          {skillImage?.src && (
            <Image
              src={skillImage.src}
              alt={skill}
              fill
              className="object-contain"
            />
          )}
        </div>

        {/* Name */}
        <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors text-center">
          {skill}
        </span>
      </div>
    </motion.div>
  );
};

const CategorySection = ({ category, skills, index }) => {
  const categorySkills = skills.filter((skill) =>
    skillsData.includes(skill)
  );

  if (categorySkills.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      className="mb-12 last:mb-0"
    >
      {/* Category title */}
      <div className="flex items-center gap-4 mb-6">
        <h3 className="text-lg font-display font-semibold text-white">
          {category}
        </h3>
        <div className="flex-1 h-[1px] bg-gradient-to-r from-violet-500/50 to-transparent" />
      </div>

      {/* Skills grid */}
      <div className="flex flex-wrap gap-3">
        {categorySkills.map((skill, skillIndex) => (
          <SkillBadge key={skill} skill={skill} index={skillIndex} />
        ))}
      </div>
    </motion.div>
  );
};

function Skills() {
  const [viewMode, setViewMode] = useState("category"); // 'category' or 'all'

  return (
    <section id="skills" className="relative py-24 lg:py-32">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-violet-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Section Header */}
      <FadeIn>
        <div className="text-center mb-12">
          <span className="inline-block text-sm font-mono text-violet-400 mb-4">
            &lt;skills&gt;
          </span>
          <h2 className="section-heading">Tech Stack</h2>
          <p className="section-subheading mx-auto">
            Technologies and tools I work with to bring ideas to life.
          </p>
        </div>
      </FadeIn>

      {/* View toggle */}
      <FadeIn>
        <div className="flex justify-center gap-2 mb-12">
          <button
            onClick={() => setViewMode("category")}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${viewMode === "category"
                ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                : "text-gray-400 hover:text-white"
              }`}
          >
            By Category
          </button>
          <button
            onClick={() => setViewMode("all")}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${viewMode === "all"
                ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                : "text-gray-400 hover:text-white"
              }`}
          >
            All Skills
          </button>
        </div>
      </FadeIn>

      {/* Skills content */}
      <AnimatePresence mode="wait">
        {viewMode === "category" ? (
          <motion.div
            key="category"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {Object.entries(skillCategories).map(
              ([category, skills], index) => (
                <CategorySection
                  key={category}
                  category={category}
                  skills={skills}
                  index={index}
                />
              )
            )}
          </motion.div>
        ) : (
          <motion.div
            key="all"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-wrap gap-3 justify-center"
          >
            {skillsData.map((skill, index) => (
              <SkillBadge key={skill} skill={skill} index={index} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section closing tag */}
      <FadeIn>
        <div className="text-center mt-16">
          <span className="text-sm font-mono text-violet-400">
            &lt;/skills&gt;
          </span>
        </div>
      </FadeIn>
    </section>
  );
}

export default Skills;