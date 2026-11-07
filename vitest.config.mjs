export default {
  test: {
    include: ["packages/**/src/**/*.test.ts", "apps/**/__tests__/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
  },
};
