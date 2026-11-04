export interface SuggestionItem {
  label: string;
  insertText: string;
  kind: 'keyword' | 'function' | 'class' | 'module' | 'file' | 'variable';
  detail?: string;
  documentation?: string;
}

// ---------------------------------------------------------------------------
// Standard Library & Common APIs
// ---------------------------------------------------------------------------
const JAVA_SUGGESTIONS: SuggestionItem[] = [
  // Output & I/O
  { label: 'System.out.println', insertText: 'System.out.println($0);', kind: 'function', detail: 'void println(Object x)', documentation: 'Prints an argument and terminates the line.' },
  { label: 'System.out.print', insertText: 'System.out.print($0);', kind: 'function', detail: 'void print(Object x)', documentation: 'Prints an argument to stdout.' },
  { label: 'System.out.printf', insertText: 'System.out.printf("$0\\n", );', kind: 'function', detail: 'PrintStream printf(String format, Object... args)', documentation: 'Writes a formatted string to stdout.' },
  { label: 'Scanner', insertText: 'Scanner scanner = new Scanner(System.in);', kind: 'class', detail: 'java.util.Scanner', documentation: 'Simple text scanner for parsing primitives and strings.' },
  { label: 'scanner.nextLine()', insertText: 'scanner.nextLine()', kind: 'function', detail: 'String nextLine()', documentation: 'Advances this scanner past the current line and returns the input that was skipped.' },
  { label: 'scanner.nextInt()', insertText: 'scanner.nextInt()', kind: 'function', detail: 'int nextInt()', documentation: 'Scans the next token of the input as an int.' },
  { label: 'scanner.nextDouble()', insertText: 'scanner.nextDouble()', kind: 'function', detail: 'double nextDouble()', documentation: 'Scans the next token of the input as a double.' },
  { label: 'scanner.nextBoolean()', insertText: 'scanner.nextBoolean()', kind: 'function', detail: 'boolean nextBoolean()', documentation: 'Scans the next token of the input as a boolean.' },

  // Wrappers & Math
  { label: 'Integer.parseInt', insertText: 'Integer.parseInt($0)', kind: 'function', detail: 'int parseInt(String s)', documentation: 'Parses the string argument as a signed decimal integer.' },
  { label: 'Integer.valueOf', insertText: 'Integer.valueOf($0)', kind: 'function', detail: 'Integer valueOf(int i)', documentation: 'Returns an Integer instance representing the specified int value.' },
  { label: 'Double.parseDouble', insertText: 'Double.parseDouble($0)', kind: 'function', detail: 'double parseDouble(String s)', documentation: 'Returns a new double initialized to the value represented by the specified String.' },
  { label: 'Boolean.parseBoolean', insertText: 'Boolean.parseBoolean($0)', kind: 'function', detail: 'boolean parseBoolean(String s)', documentation: 'Parses the string argument as a boolean.' },
  { label: 'Math.max', insertText: 'Math.max($0, )', kind: 'function', detail: 'T max(T a, T b)', documentation: 'Returns the greater of two values.' },
  { label: 'Math.min', insertText: 'Math.min($0, )', kind: 'function', detail: 'T min(T a, T b)', documentation: 'Returns the smaller of two values.' },
  { label: 'Math.sqrt', insertText: 'Math.sqrt($0)', kind: 'function', detail: 'double sqrt(double a)', documentation: 'Returns the correctly rounded positive square root of a double value.' },
  { label: 'Math.abs', insertText: 'Math.abs($0)', kind: 'function', detail: 'T abs(T a)', documentation: 'Returns the absolute value.' },
  { label: 'Math.pow', insertText: 'Math.pow($0, )', kind: 'function', detail: 'double pow(double a, double b)', documentation: 'Returns the value of the first argument raised to the power of the second argument.' },
  { label: 'Math.random()', insertText: 'Math.random()', kind: 'function', detail: 'double random()', documentation: 'Returns a double value with a positive sign, greater than or equal to 0.0 and less than 1.0.' },

  // Collections & Arrays
  { label: 'ArrayList', insertText: 'ArrayList<${1:String}> list = new ArrayList<>();', kind: 'class', detail: 'java.util.ArrayList', documentation: 'Resizable-array implementation of the List interface.' },
  { label: 'Arrays.toString', insertText: 'Arrays.toString($0)', kind: 'function', detail: 'String toString(Object[] a)', documentation: 'Returns a string representation of the contents of the specified array.' },
  { label: 'Arrays.sort', insertText: 'Arrays.sort($0);', kind: 'function', detail: 'void sort(Object[] a)', documentation: 'Sorts the specified array into ascending numerical/natural order.' },
  { label: 'Collections.sort', insertText: 'Collections.sort($0);', kind: 'function', detail: 'void sort(List<T> list)', documentation: 'Sorts the specified list into ascending order.' },
  { label: 'File', insertText: 'new File("$0")', kind: 'class', detail: 'java.io.File', documentation: 'An abstract representation of file and directory pathnames.' },

  // Keywords
  { label: 'public static void main', insertText: 'public static void main(String[] args) {\n    $0\n}', kind: 'keyword', detail: 'Java main method', documentation: 'Entrypoint for Java application.' },
  { label: 'if', insertText: 'if ($0) {\n    \n}', kind: 'keyword' },
  { label: 'else', insertText: 'else {\n    $0\n}', kind: 'keyword' },
  { label: 'for', insertText: 'for (int i = 0; i < $1; i++) {\n    $0\n}', kind: 'keyword' },
  { label: 'while', insertText: 'while ($0) {\n    \n}', kind: 'keyword' },
  { label: 'switch', insertText: 'switch ($1) {\n    case $2:\n        $0\n        break;\n    default:\n        break;\n}', kind: 'keyword' },
  { label: 'try / catch', insertText: 'try {\n    $0\n} catch (Exception e) {\n    \n}', kind: 'keyword' },
];

const CPP_SUGGESTIONS: SuggestionItem[] = [
  // Common includes
  { label: '#include <iostream>', insertText: '#include <iostream>\n', kind: 'module', documentation: 'Standard input/output stream objects.' },
  { label: '#include <vector>', insertText: '#include <vector>\n', kind: 'module', documentation: 'Sequence container representing arrays that can change in size.' },
  { label: '#include <string>', insertText: '#include <string>\n', kind: 'module', documentation: 'Standard string class.' },
  { label: '#include <algorithm>', insertText: '#include <algorithm>\n', kind: 'module', documentation: 'Standard algorithms (std::sort, std::max, std::min, etc).' },
  { label: '#include <cmath>', insertText: '#include <cmath>\n', kind: 'module', documentation: 'C numerics and mathematical functions.' },
  { label: '#include <fstream>', insertText: '#include <fstream>\n', kind: 'module', documentation: 'Input/output stream class to operate on files.' },

  // Standard library members
  { label: 'std::cout', insertText: 'std::cout << $0 << std::endl;', kind: 'function', detail: 'std::ostream cout', documentation: 'Standard output stream.' },
  { label: 'std::cin', insertText: 'std::cin >> $0;', kind: 'function', detail: 'std::istream cin', documentation: 'Standard input stream.' },
  { label: 'std::endl', insertText: 'std::endl', kind: 'variable', documentation: 'Inserts a newline character into the output sequence and flushes the stream.' },
  { label: 'std::vector', insertText: 'std::vector<${1:int}> $0;', kind: 'class', detail: 'template<class T> class vector', documentation: 'Dynamic size sequence container.' },
  { label: 'std::string', insertText: 'std::string $0;', kind: 'class', detail: 'typedef basic_string<char> string', documentation: 'Standard character string.' },
  { label: 'std::sort', insertText: 'std::sort($1.begin(), $1.end());', kind: 'function', detail: 'void sort(RandomIt first, RandomIt last)', documentation: 'Sorts elements in the range [first, last).' },
  { label: 'std::max', insertText: 'std::max($0, )', kind: 'function', detail: 'const T& max(const T& a, const T& b)', documentation: 'Returns the greater of the given values.' },
  { label: 'std::min', insertText: 'std::min($0, )', kind: 'function', detail: 'const T& min(const T& a, const T& b)', documentation: 'Returns the smaller of the given values.' },
  { label: 'push_back', insertText: 'push_back($0);', kind: 'function', detail: 'void push_back(const T& value)', documentation: 'Appends the given element value to the end of the container.' },
  { label: 'size()', insertText: 'size()', kind: 'function', detail: 'size_type size() const', documentation: 'Returns the number of elements in the container.' },
  { label: 'empty()', insertText: 'empty()', kind: 'function', detail: 'bool empty() const', documentation: 'Checks if the container has no elements.' },

  // Boilerplate & Keywords
  { label: 'int main', insertText: 'int main(int argc, char* argv[]) {\n    $0\n    return 0;\n}', kind: 'keyword', documentation: 'Entry point for C++ program.' },
  { label: 'for (auto)', insertText: 'for (const auto& item : $1) {\n    $0\n}', kind: 'keyword' },
  { label: 'for (int)', insertText: 'for (int i = 0; i < $1; ++i) {\n    $0\n}', kind: 'keyword' },
  { label: 'while', insertText: 'while ($0) {\n    \n}', kind: 'keyword' },
  { label: 'if', insertText: 'if ($0) {\n    \n}', kind: 'keyword' },
];

const PYTHON_SUGGESTIONS: SuggestionItem[] = [
  { label: 'print', insertText: 'print($0)', kind: 'function', detail: 'print(*values, sep=" ", end="\\n")', documentation: 'Prints the values to a stream, or to sys.stdout by default.' },
  { label: 'len', insertText: 'len($0)', kind: 'function', detail: 'len(obj)', documentation: 'Return the number of items in a container.' },
  { label: 'range', insertText: 'range($0)', kind: 'function', detail: 'range(stop) or range(start, stop[, step])', documentation: 'Returns a sequence of numbers from start to stop.' },
  { label: 'enumerate', insertText: 'enumerate($0)', kind: 'function', detail: 'enumerate(iterable, start=0)', documentation: 'Return an enumerate object yielding (index, value) tuples.' },
  { label: 'input', insertText: 'input("$0")', kind: 'function', detail: 'input(prompt=None)', documentation: 'Read a string from standard input.' },
  { label: 'open', insertText: 'open("$0", "r")', kind: 'function', detail: 'open(file, mode="r")', documentation: 'Open file and return a stream.' },
  { label: 'append', insertText: 'append($0)', kind: 'function', detail: 'list.append(item)', documentation: 'Append object to the end of the list.' },
  { label: 'def', insertText: 'def ${1:func_name}($2):\n    $0', kind: 'keyword', documentation: 'Function definition.' },
  { label: 'class', insertText: 'class ${1:ClassName}:\n    def __init__(self$2):\n        $0', kind: 'keyword', documentation: 'Class definition.' },
  { label: 'if __name__ == "__main__":', insertText: 'if __name__ == "__main__":\n    $0', kind: 'keyword', documentation: 'Script entrypoint guard.' },
  { label: 'import math', insertText: 'import math\n', kind: 'module', documentation: 'Mathematical functions.' },
  { label: 'import sys', insertText: 'import sys\n', kind: 'module', documentation: 'System-specific parameters and functions.' },
  { label: 'import json', insertText: 'import json\n', kind: 'module', documentation: 'JSON encoder and decoder.' },
];

// ---------------------------------------------------------------------------
// Context Scanner: extracts symbols from code and detects file contexts
// ---------------------------------------------------------------------------
export function getSuggestions(
  currentCode: string,
  cursorIndex: number,
  filePath: string,
  allFilePaths: string[] = []
): { items: SuggestionItem[]; prefix: string; replaceStart: number } {
  const textBeforeCursor = currentCode.slice(0, cursorIndex);

  // 1. Detect VFS file completion (e.g. #include "...", new File("..."), open("..."))
  const quoteMatch = textBeforeCursor.match(/(?:#include\s*["<]|new\s+File\s*\(\s*["']|open\s*\(\s*["']|FileReader\s*\(\s*["'])([^"'>]*)$/);
  if (quoteMatch) {
    const filePrefix = quoteMatch[1];
    const replaceStart = cursorIndex - filePrefix.length;
    const fileItems: SuggestionItem[] = allFilePaths
      .filter((p) => p !== filePath)
      .map((p) => {
        const basename = p.split('/').pop() || p;
        return {
          label: basename,
          insertText: basename,
          kind: 'file',
          detail: p,
          documentation: `Project virtual file: ${p}`,
        };
      });

    const filtered = fileItems.filter((item) =>
      item.label.toLowerCase().includes(filePrefix.toLowerCase())
    );
    return { items: filtered, prefix: filePrefix, replaceStart };
  }

  // 2. Detect general word or member prefix
  const wordMatch = textBeforeCursor.match(/([A-Za-z0-9_$.:]+)$/);
  if (!wordMatch) {
    return { items: [], prefix: '', replaceStart: cursorIndex };
  }

  const prefix = wordMatch[1];
  const replaceStart = cursorIndex - prefix.length;
  const ext = filePath.split('.').pop()?.toLowerCase();

  // Base suggestions by language
  let baseSuggestions: SuggestionItem[] = [];
  if (ext === 'java') {
    baseSuggestions = JAVA_SUGGESTIONS;
  } else if (ext === 'cpp' || ext === 'hpp' || ext === 'cc' || ext === 'h') {
    baseSuggestions = CPP_SUGGESTIONS;
  } else if (ext === 'py') {
    baseSuggestions = PYTHON_SUGGESTIONS;
  }

  // 3. Extract identifiers declared in current file
  const identifiers = new Set<string>();
  const idRegex = /\b[A-Za-z_][A-Za-z0-9_]{2,}\b/g;
  let match: RegExpExecArray | null;
  while ((match = idRegex.exec(currentCode)) !== null) {
    const id = match[0];
    if (id !== prefix) {
      identifiers.add(id);
    }
  }

  const projectSymbols: SuggestionItem[] = Array.from(identifiers).map((id) => ({
    label: id,
    insertText: id,
    kind: 'variable',
    detail: 'Identifier',
  }));

  const all = [...baseSuggestions, ...projectSymbols];
  const lowerPrefix = prefix.toLowerCase();

  const filtered = all.filter((s) => {
    const lowerLabel = s.label.toLowerCase();
    return lowerLabel.startsWith(lowerPrefix) || lowerLabel.includes(lowerPrefix);
  });

  // Sort: exact startsWith first, then shorter labels
  filtered.sort((a, b) => {
    const aStarts = a.label.toLowerCase().startsWith(lowerPrefix);
    const bStarts = b.label.toLowerCase().startsWith(lowerPrefix);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return a.label.length - b.label.length;
  });

  return {
    items: filtered.slice(0, 15),
    prefix,
    replaceStart,
  };
}
