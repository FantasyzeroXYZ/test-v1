/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",     
    "./*.{js,ts,jsx,tsx}",        // 根目录下文件 (如 App.tsx)
    
    // 🔥 关键修改：添加 components 文件夹的路径
    "./components/**/*.{js,ts,jsx,tsx}", 
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        glass: "rgba(255, 255, 255, 0.08)",
        glassBorder: "rgba(255, 255, 255, 0.15)",
        primary: "#6366f1", // Indigo 500
        secondary: "#ec4899", // Pink 500
      }
    }
  },
  plugins: [],
}

