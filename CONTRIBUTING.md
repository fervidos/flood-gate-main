# Contributing to FloodGate

Thank you for considering contributing to **FloodGate**! We welcome contributions of all kinds – bug reports, feature ideas, documentation improvements, and code contributions.

## How to Contribute

### 1. Fork the Repository
- Click the **Fork** button on the GitHub repository page to create your own copy of the project.

### 2. Clone Your Fork
```bash
git clone https://github.com/<your-username>/floodgate.git
cd floodgate
```

### 3. Create a New Branch
```bash
git checkout -b <feature-or-fix-name>
```
Use a descriptive branch name, e.g., `fix-proxy-rotation` or `add-dashboard-tests`.

### 4. Make Your Changes
- Follow the existing code style (ESM modules, async/await, lint rules).
- Update or add tests in the `tests/` directory if applicable.
- Run the test suite to ensure everything passes:
```bash
npm test
```

### 5. Commit Your Work
```bash
git add .
git commit -m "Brief description of your change"
```
Write clear commit messages; reference any related issue numbers.

### 6. Push to Your Fork
```bash
git push origin <feature-or-fix-name>
```

### 7. Open a Pull Request (PR)
- Navigate to the original repository and click **New Pull Request**.
- Select your branch as the source and the `main` branch of the upstream repo as the target.
- Provide a descriptive title and a detailed description of what your PR does, why it’s needed, and any relevant screenshots.

## Code Style & Guidelines
- **Formatting**: Use Prettier (run `npm run format` if configured).
- **Linting**: Follow ESLint rules (`npm run lint`).
- **Types**: Keep the code TypeScript‑friendly; add JSDoc comments where helpful.
- **Documentation**: Update the README or other docs if you add new features.
- **Testing**: Add unit tests for new functionality. Use Jest as the test runner.

## Reporting Issues
- Open an issue on GitHub with a clear title and description.
- Include steps to reproduce, expected behavior, and actual behavior.
- Attach logs or screenshots if relevant.

## Community & Support
- For quick questions, feel free to open a discussion on the GitHub Discussions page.
- Follow the project's **Code of Conduct** (see `CODE_OF_CONDUCT.md`).

## License
By contributing, you agree that your contributions will be licensed under the same ISC license as the project.

---

*Happy hacking!*
