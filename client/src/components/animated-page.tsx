import { motion, AnimatePresence } from 'framer-motion';
import React from 'react';

interface AnimatedPageProps {
  children: React.ReactNode;
  className?: string; // Allow passing additional class names
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 20, // Start slightly below
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4, // Adjust duration as needed
      ease: "easeInOut",
    },
  },
  exit: {
    opacity: 0,
    y: -20, // Exit slightly above
    transition: {
      duration: 0.3,
      ease: "easeInOut",
    },
  },
};

const AnimatedPage: React.FC<AnimatedPageProps> = ({ children, className }) => {
  return (
    // AnimatePresence is needed if you want exit animations when component unmounts (e.g., route changes)
    // For simple mount animation, motion.div is enough. Let's keep AnimatePresence for flexibility.
    <AnimatePresence mode="wait">
      <motion.div
        key={React.useId()} // Add a key for AnimatePresence to track component changes
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants}
        className={className} // Apply passed class names
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

export default AnimatedPage;