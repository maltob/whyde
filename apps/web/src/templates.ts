import { Project } from '@ide/project-model';

export const STARTER_PROJECTS: Record<'python' | 'java' | 'cpp' | 'javascript', () => Project> = {
  javascript: () => ({
    schemaVersion: 1,
    kind: 'browser-ide-project',
    id: `proj-js-${Date.now()}`,
    name: 'JavaScript Starter',
    language: 'javascript',
    entrypoint: 'src/main.js',
    files: [
      {
        path: 'src/main.js',
        encoding: 'utf-8',
        content: `// Modern JavaScript (ES2024+) Starter
function main() {
    console.log("Hello from in-browser JavaScript!");
    
    const items = [10, 20, 30, 40, 50];
    const squared = items.map(x => x * x);
    console.log("Squared numbers:", squared);
    
    const sum = squared.reduce((acc, curr) => acc + curr, 0);
    console.log("Total sum:", sum);
}

main();
`,
      },
    ],
    toolchain: {
      runtimeId: 'javascript-native',
      requestedVersion: 'ES2024',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),

  python: () => ({
    schemaVersion: 1,
    kind: 'browser-ide-project',
    id: `proj-python-${Date.now()}`,
    name: 'Python Starter',
    language: 'python',
    entrypoint: 'src/main.py',
    files: [
      {
        path: 'src/main.py',
        encoding: 'utf-8',
        content: `# Python 3.14 Starter
import sys

def main():
    print(f"Hello from Python {sys.version.split()[0]}!")
    name = input("What is your name? ")
    print(f"Welcome, {name}!")

if __name__ == "__main__":
    main()
`,
      },
    ],
    toolchain: {
      runtimeId: 'python-pyodide',
      requestedVersion: '314.0.7',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),

  java: () => ({
    schemaVersion: 1,
    kind: 'browser-ide-project',
    id: `proj-java-${Date.now()}`,
    name: 'Java Starter',
    language: 'java',
    entrypoint: 'src/demo/Main.java',
    files: [
      {
        path: 'src/demo/Main.java',
        encoding: 'utf-8',
        content: `package demo;

import java.util.Scanner;

public final class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java 11+!");
        Scanner scanner = new Scanner(System.in);
        System.out.print("Enter your name: ");
        if (scanner.hasNextLine()) {
            String name = scanner.nextLine();
            System.out.println("Hi " + name + "!");
        }
    }
}
`,
      },
      {
        path: 'src/demo/Helper.java',
        encoding: 'utf-8',
        content: `package demo;

public class Helper {
    public static String getVersionInfo() {
        return "Java In-Browser Runner (OSS Track)";
    }
}
`,
      },
    ],
    toolchain: {
      runtimeId: 'java-ecj-bjvm',
      requestedVersion: '11',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),

  cpp: () => ({
    schemaVersion: 1,
    kind: 'browser-ide-project',
    id: `proj-cpp-${Date.now()}`,
    name: 'C++ Starter',
    language: 'cpp',
    entrypoint: 'src/main.cpp',
    files: [
      {
        path: 'src/main.cpp',
        encoding: 'utf-8',
        content: `#include <iostream>
#include <string>
#include "helper.hpp"

int main() {
    std::cout << "Hello from C++17+!" << std::endl;
    std::cout << "Enter your favorite programming language: ";
    std::string lang;
    if (std::cin >> lang) {
        std::cout << "Awesome! " << lang << " is great." << std::endl;
    }
    greet();
    return 0;
}
`,
      },
      {
        path: 'src/helper.hpp',
        encoding: 'utf-8',
        content: `#pragma once
void greet();
`,
      },
      {
        path: 'src/helper.cpp',
        encoding: 'utf-8',
        content: `#include <iostream>
#include "helper.hpp"

void greet() {
    std::cout << "Greetings from helper translation unit!" << std::endl;
}
`,
      },
    ],
    toolchain: {
      runtimeId: 'cpp-yowasp',
      requestedVersion: '17',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
};

export const BLANK_PROJECTS: Record<'python' | 'java' | 'cpp' | 'javascript', () => Project> = {
  javascript: () => ({
    schemaVersion: 1,
    kind: 'browser-ide-project',
    id: `proj-js-blank-${Date.now()}`,
    name: 'JavaScript (Blank)',
    language: 'javascript',
    entrypoint: 'src/main.js',
    files: [
      {
        path: 'src/main.js',
        encoding: 'utf-8',
        content: `// Write your JavaScript solution here\n`,
      },
    ],
    toolchain: {
      runtimeId: 'javascript-native',
      requestedVersion: 'ES2024',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),

  python: () => ({
    schemaVersion: 1,
    kind: 'browser-ide-project',
    id: `proj-python-blank-${Date.now()}`,
    name: 'Python (Blank)',
    language: 'python',
    entrypoint: 'src/main.py',
    files: [
      {
        path: 'src/main.py',
        encoding: 'utf-8',
        content: ``,
      },
    ],
    toolchain: {
      runtimeId: 'python-pyodide',
      requestedVersion: '314.0.7',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),

  java: () => ({
    schemaVersion: 1,
    kind: 'browser-ide-project',
    id: `proj-java-blank-${Date.now()}`,
    name: 'Java (Blank)',
    language: 'java',
    entrypoint: 'src/demo/Main.java',
    files: [
      {
        path: 'src/demo/Main.java',
        encoding: 'utf-8',
        content: `public class Main {
    public static void main(String[] args) {
        // Write your solution here
    }
}
`,
      },
    ],
    toolchain: {
      runtimeId: 'java-ecj-bjvm',
      requestedVersion: '11',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),

  cpp: () => ({
    schemaVersion: 1,
    kind: 'browser-ide-project',
    id: `proj-cpp-blank-${Date.now()}`,
    name: 'C++ (Blank)',
    language: 'cpp',
    entrypoint: 'src/main.cpp',
    files: [
      {
        path: 'src/main.cpp',
        encoding: 'utf-8',
        content: `#include <iostream>

int main() {
    // Write your solution here
    return 0;
}
`,
      },
    ],
    toolchain: {
      runtimeId: 'cpp-yowasp',
      requestedVersion: '17',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
};
