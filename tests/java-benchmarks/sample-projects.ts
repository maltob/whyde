import { parse } from 'java-parser';

export interface BenchmarkProject {
  id: string;
  name: string;
  category: string;
  source: string;
  files?: Record<string, string>;
  expectedOutput: string;
  stdin?: string;
}

export const BENCHMARK_PROJECTS: BenchmarkProject[] = [
  // 1. Classic AP CS / CS1: Fibonacci & Recursion (CPU / Stack frames)
  {
    id: 'cs1-recursion-fib',
    name: 'Recursive Fibonacci (N=20)',
    category: 'Stack Frames & Recursion',
    source: `public class Main {
    public static int fib(int n) {
        if (n <= 1) return n;
        return fib(n - 1) + fib(n - 2);
    }
    public static void main(String[] args) {
        int result = fib(20);
        System.out.println("Fib(20) = " + result);
    }
}`,
    expectedOutput: 'Fib(20) = 6765',
  },

  // 2. Data Structures & Algorithms: Quicksort with Arrays
  {
    id: 'cs2-sorting-quicksort',
    name: 'In-Place Quicksort (1000 Elements)',
    category: 'Arrays & Heap Mutations',
    source: `public class Main {
    static void swap(int[] arr, int i, int j) {
        int temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
    }
    static int partition(int[] arr, int low, int high) {
        int pivot = arr[high];
        int i = (low - 1);
        for (int j = low; j <= high - 1; j++) {
            if (arr[j] < pivot) {
                i++;
                swap(arr, i, j);
            }
        }
        swap(arr, i + 1, high);
        return (i + 1);
    }
    static void quickSort(int[] arr, int low, int high) {
        if (low < high) {
            int pi = partition(arr, low, high);
            quickSort(arr, low, pi - 1);
            quickSort(arr, pi + 1, high);
        }
    }
    public static void main(String[] args) {
        int[] data = new int[1000];
        for (int i = 0; i < 1000; i++) {
            data[i] = (1000 - i) * 3 % 997;
        }
        quickSort(data, 0, data.length - 1);
        System.out.println("Sorted First: " + data[0] + ", Last: " + data[data.length - 1]);
    }
}`,
    expectedOutput: 'Sorted First: 0, Last: 996',
  },

  // 3. Object-Oriented Programming: Polymorphism, Inheritance & Interfaces
  {
    id: 'cs1-oop-polymorphism',
    name: 'OOP Hierarchy & Dynamic Dispatch',
    category: 'Virtual Method Tables & Objects',
    source: `interface Shape {
    double area();
    String name();
}

class Circle implements Shape {
    private double radius;
    public Circle(double r) { this.radius = r; }
    public double area() { return 3.14159 * radius * radius; }
    public String name() { return "Circle"; }
}

class Rectangle implements Shape {
    private double w, h;
    public Rectangle(double w, double h) { this.w = w; this.h = h; }
    public double area() { return w * h; }
    public String name() { return "Rectangle"; }
}

public class Main {
    public static void main(String[] args) {
        Shape[] shapes = new Shape[] {
            new Circle(5.0),
            new Rectangle(4.0, 6.0)
        };
        double total = 0;
        for (Shape s : shapes) {
            total += s.area();
        }
        System.out.println("Total Area = " + (int)total);
    }
}`,
    expectedOutput: 'Total Area = 102',
  },

  // 4. Standard Library Collections & Generics (ArrayList & HashMap)
  {
    id: 'cs2-collections-wordcount',
    name: 'Collections & Generics Word Count',
    category: 'Standard Library Collections',
    source: `import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

public class Main {
    public static void main(String[] args) {
        ArrayList<String> words = new ArrayList<>();
        words.add("apple");
        words.add("banana");
        words.add("apple");
        words.add("cherry");
        words.add("banana");
        words.add("apple");

        Map<String, Integer> counts = new HashMap<>();
        for (String w : words) {
            counts.put(w, counts.getOrDefault(w, 0) + 1);
        }
        System.out.println("apple count: " + counts.get("apple"));
    }
}`,
    expectedOutput: 'apple count: 3',
  },

  // 5. Interactive Terminal Stdin (Scanner & Token Parsing)
  {
    id: 'cs1-interactive-scanner',
    name: 'Interactive Scanner IO',
    category: 'Interactive Stdin & Tokenizer',
    stdin: 'Ada Lovelace 42\n',
    source: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String firstName = sc.next();
        String lastName = sc.next();
        int score = sc.nextInt();
        System.out.println("User: " + firstName + " " + lastName + " - Score: " + score);
    }
}`,
    expectedOutput: 'User: Ada Lovelace - Score: 42',
  },
];
