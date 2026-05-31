"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import emailjs from "@emailjs/browser";
import { toast } from "react-toastify";
import { personalData } from "@/utils/data/personal-data";
import { FadeIn } from "../../ui/page-transition";
import MagneticButton from "../../ui/magnetic-button";
import ClickToCopy from "../../ui/click-to-copy";
import { BsGithub, BsLinkedin, BsSend } from "react-icons/bs";
import { FaXTwitter } from "react-icons/fa6";
import { MdEmail, MdPhone, MdLocationOn } from "react-icons/md";
import { useAudio } from "@/app/providers/audio-provider";
import { useHaptics } from "@/app/hooks/use-haptics";

const contactInfo = [
    { icon: MdEmail, label: "Email", value: personalData.email, href: null, copyable: true },
    { icon: MdPhone, label: "Phone", value: personalData.phone, href: `tel:${personalData.phone}`, copyable: false },
    { icon: MdLocationOn, label: "Location", value: personalData.address, href: null, copyable: false },
];

const socialLinks = [
    { icon: BsGithub, href: personalData.github, label: "GitHub" },
    { icon: BsLinkedin, href: personalData.linkedIn, label: "LinkedIn" },
    { icon: FaXTwitter, href: personalData.twitter, label: "Twitter" },
];

function ContactSection() {
    const formRef = useRef(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        message: "",
    });

    // Audio and haptics (with fallback if not in provider)
    let playSound = () => { };
    let vibrateOnSuccess = () => { };
    let vibrateOnError = () => { };
    try {
        const audio = useAudio();
        playSound = audio.playSound;
    } catch {
        // AudioProvider not available
    }
    try {
        const haptics = useHaptics();
        vibrateOnSuccess = haptics.vibrateOnSuccess;
        vibrateOnError = haptics.vibrateOnError;
    } catch {
        // Haptics not available
    }

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            await emailjs.sendForm(
                process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID,
                process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID,
                formRef.current,
                process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
            );

            // Success feedback
            playSound("whoosh");
            vibrateOnSuccess();
            toast.success("Message sent successfully!");
            setFormData({ name: "", email: "", message: "" });
        } catch (error) {
            // Error feedback
            vibrateOnError();
            toast.error("Failed to send message. Please try again.");
            console.error("EmailJS Error:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section id="contact" className="relative py-24 lg:py-32">
            {/* Background decoration */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/4 right-0 w-96 h-96 bg-violet-500/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-[100px]" />
            </div>

            {/* Section Header */}
            <FadeIn>
                <div className="text-center mb-16">
                    <span className="inline-block text-sm font-mono text-violet-400 mb-4">
                        &lt;contact&gt;
                    </span>
                    <h2 className="section-heading">Get In Touch</h2>
                    <p className="section-subheading mx-auto">
                        Have a project in mind or want to collaborate? Let&apos;s talk!
                    </p>
                </div>
            </FadeIn>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
                {/* Left - Contact Info */}
                <FadeIn direction="left">
                    <div className="space-y-8">
                        {/* Contact details */}
                        <div className="space-y-6">
                            {contactInfo.map((info, index) => (
                                <motion.div
                                    key={info.label}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.1 }}
                                    className="flex items-center gap-4 group"
                                >
                                    <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 group-hover:border-violet-500/50 transition-colors">
                                        <info.icon className="text-violet-400" size={20} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wider">
                                            {info.label}
                                        </p>
                                        {info.copyable ? (
                                            <ClickToCopy
                                                text={info.value}
                                                successMessage="Email copied!"
                                                className="!p-0 !bg-transparent !border-0"
                                            >
                                                <span className="text-gray-300 hover:text-violet-400 transition-colors flex items-center gap-2">
                                                    {info.value}
                                                    <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                                    </svg>
                                                </span>
                                            </ClickToCopy>
                                        ) : info.href ? (
                                            <Link
                                                href={info.href}
                                                className="text-gray-300 hover:text-violet-400 transition-colors"
                                            >
                                                {info.value}
                                            </Link>
                                        ) : (
                                            <p className="text-gray-300">{info.value}</p>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Social links */}
                        <div>
                            <p className="text-sm text-gray-500 uppercase tracking-wider mb-4">
                                Connect with me
                            </p>
                            <div className="flex gap-3">
                                {socialLinks.map((social, index) => (
                                    <motion.div
                                        key={social.label}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        whileInView={{ opacity: 1, scale: 1 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: index * 0.1 }}
                                        whileHover={{ scale: 1.1, y: -2 }}
                                    >
                                        <Link
                                            href={social.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-violet-500/50 hover:bg-violet-500/10 transition-all"
                                            aria-label={social.label}
                                        >
                                            <social.icon size={20} />
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Quote */}
                        <div className="glass-card p-6 mt-8">
                            <p className="text-gray-400 italic">
                                &quot;The best way to predict the future is to create it.&quot;
                            </p>
                            <p className="text-sm text-violet-400 mt-2">— Peter Drucker</p>
                        </div>
                    </div>
                </FadeIn>

                {/* Right - Contact Form */}
                <FadeIn direction="right">
                    <form
                        ref={formRef}
                        onSubmit={handleSubmit}
                        className="glass-card p-6 md:p-8 space-y-6"
                    >
                        {/* Name */}
                        <div>
                            <label
                                htmlFor="name"
                                className="block text-sm font-medium text-gray-400 mb-2"
                            >
                                Name
                            </label>
                            <input
                                type="text"
                                id="name"
                                name="from_name"
                                value={formData.from_name}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
                                placeholder="Your name"
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium text-gray-400 mb-2"
                            >
                                Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                suppressHydrationWarning
                                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
                                placeholder="your@email.com"
                            />
                        </div>

                        {/* Message */}
                        <div>
                            <label
                                htmlFor="message"
                                className="block text-sm font-medium text-gray-400 mb-2"
                            >
                                Message
                            </label>
                            <textarea
                                id="message"
                                name="message"
                                value={formData.message}
                                onChange={handleChange}
                                required
                                rows={5}
                                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all resize-none"
                                placeholder="Tell me about your project..."
                            />
                        </div>

                        {/* Submit button */}
                        <MagneticButton
                            type="submit"
                            variant="primary"
                            size="lg"
                            className="w-full"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Sending...</span>
                                </>
                            ) : (
                                <>
                                    <span>Send Message</span>
                                    <BsSend size={16} />
                                </>
                            )}
                        </MagneticButton>
                    </form>
                </FadeIn>
            </div>

            {/* Section closing tag */}
            <FadeIn>
                <div className="text-center mt-16">
                    <span className="text-sm font-mono text-violet-400">
                        &lt;/contact&gt;
                    </span>
                </div>
            </FadeIn>
        </section>
    );
}

export default ContactSection;
