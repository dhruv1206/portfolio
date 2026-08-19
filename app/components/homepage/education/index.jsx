"use client";

import { motion } from "framer-motion";
import { educations } from "@/utils/data/educations";
import { FadeIn } from "../../ui/page-transition";
import { BsCalendar, BsBuilding } from "react-icons/bs";

function Education() {
  return (
    <section id="education" className="relative py-16 sm:py-24 lg:py-32">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-pink-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Section Header */}
      <FadeIn>
        <div className="text-center mb-16">
          <span className="inline-block text-sm font-mono text-violet-400 mb-4">
            &lt;education&gt;
          </span>
          <h2 className="section-heading">Education</h2>
          <p className="section-subheading mx-auto">
            My academic journey and qualifications.
          </p>
        </div>
      </FadeIn>

      {/* Education cards */}
      <div className="max-w-2xl mx-auto space-y-6">
        {educations.map((edu, index) => (
          <motion.div
            key={edu.id}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="glass-card p-6 group"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Left - Title & Institution */}
              <div className="flex-1">
                <h3 className="text-lg font-display font-semibold text-white group-hover:text-violet-300 transition-colors mb-2">
                  {edu.title}
                </h3>
                <div className="flex items-center gap-2 text-gray-400">
                  <BsBuilding size={14} />
                  <span className="text-sm">{edu.institution}</span>
                </div>
              </div>

              {/* Right - Duration */}
              <div className="flex items-center gap-2 text-cyan-400">
                <BsCalendar size={14} />
                <span className="text-sm font-mono">{edu.duration}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Section closing tag */}
      <FadeIn>
        <div className="text-center mt-16">
          <span className="text-sm font-mono text-violet-400">
            &lt;/education&gt;
          </span>
        </div>
      </FadeIn>
    </section>
  );
}

export default Education;