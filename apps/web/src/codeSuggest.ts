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
  { label: 'import matplotlib.pyplot as plt', insertText: 'import matplotlib.pyplot as plt\n', kind: 'module', documentation: 'Matplotlib state-based plotting interface.' },
  { label: 'import numpy as np', insertText: 'import numpy as np\n', kind: 'module', documentation: 'NumPy scientific computing package.' },
  { label: 'import pandas as pd', insertText: 'import pandas as pd\n', kind: 'module', documentation: 'Pandas fast, powerful data structures.' },
  { label: 'import requests', insertText: 'import requests\n', kind: 'module', documentation: 'HTTP library for humans.' },
  { label: 'import turtle', insertText: 'import turtle\n', kind: 'module', documentation: 'Educational turtle graphics library.' },
  { label: 'import pytest', insertText: 'import pytest\n', kind: 'module', documentation: 'Python testing framework.' },
  { label: 'from PIL import Image', insertText: 'from PIL import Image\n', kind: 'module', documentation: 'Pillow imaging library.' },
];

const MEMBER_COMPLETIONS: Record<string, SuggestionItem[]> = {
  plt: [
    { label: 'plot', insertText: 'plot($0)', kind: 'function', detail: 'plot(x, y, [fmt])', documentation: 'Plot y versus x as lines and/or markers.' },
    { label: 'show', insertText: 'show()', kind: 'function', detail: 'show()', documentation: 'Display all open figures.' },
    { label: 'scatter', insertText: 'scatter($0, )', kind: 'function', detail: 'scatter(x, y)', documentation: 'A scatter plot of y vs. x.' },
    { label: 'bar', insertText: 'bar($0, )', kind: 'function', detail: 'bar(x, height)', documentation: 'Make a bar plot.' },
    { label: 'title', insertText: 'title("$0")', kind: 'function', detail: 'title(label)', documentation: 'Set a title for the Axes.' },
    { label: 'xlabel', insertText: 'xlabel("$0")', kind: 'function', detail: 'xlabel(xlabel)', documentation: 'Set the label for the x-axis.' },
    { label: 'ylabel', insertText: 'ylabel("$0")', kind: 'function', detail: 'ylabel(ylabel)', documentation: 'Set the label for the y-axis.' },
    { label: 'legend', insertText: 'legend()', kind: 'function', detail: 'legend()', documentation: 'Place a legend on the Axes.' },
    { label: 'figure', insertText: 'figure(figsize=($1, $2))', kind: 'function', detail: 'figure()', documentation: 'Create a new figure.' },
    { label: 'subplots', insertText: 'subplots()', kind: 'function', detail: 'fig, ax = plt.subplots()', documentation: 'Create a figure and a set of subplots.' },
  ],
  turtle: [
    { label: 'forward', insertText: 'forward($0)', kind: 'function', detail: 'forward(distance)', documentation: 'Move turtle forward.' },
    { label: 'backward', insertText: 'backward($0)', kind: 'function', detail: 'backward(distance)', documentation: 'Move turtle backward.' },
    { label: 'right', insertText: 'right($0)', kind: 'function', detail: 'right(angle)', documentation: 'Turn turtle right.' },
    { label: 'left', insertText: 'left($0)', kind: 'function', detail: 'left(angle)', documentation: 'Turn turtle left.' },
    { label: 'penup', insertText: 'penup()', kind: 'function', detail: 'penup()', documentation: 'Pull the pen up.' },
    { label: 'pendown', insertText: 'pendown()', kind: 'function', detail: 'pendown()', documentation: 'Pull the pen down.' },
    { label: 'circle', insertText: 'circle($0)', kind: 'function', detail: 'circle(radius, extent=None)', documentation: 'Draw a circle with given radius.' },
    { label: 'color', insertText: 'color("$0")', kind: 'function', detail: 'color(*args)', documentation: 'Return or set pencolor and fillcolor.' },
    { label: 'pensize', insertText: 'pensize($0)', kind: 'function', detail: 'pensize(width)', documentation: 'Set line thickness.' },
    { label: 'done', insertText: 'done()', kind: 'function', detail: 'done()', documentation: 'Starts event loop or flushes drawing.' },
    { label: 'Turtle', insertText: 'Turtle()', kind: 'class', detail: 'class Turtle', documentation: 'Construct a new Turtle object.' },
    { label: 'Screen', insertText: 'Screen()', kind: 'class', detail: 'class Screen', documentation: 'Return singleton Screen object.' },
  ],
  t: [
    { label: 'forward', insertText: 'forward($0)', kind: 'function', detail: 'forward(distance)', documentation: 'Move turtle forward.' },
    { label: 'backward', insertText: 'backward($0)', kind: 'function', detail: 'backward(distance)', documentation: 'Move turtle backward.' },
    { label: 'right', insertText: 'right($0)', kind: 'function', detail: 'right(angle)', documentation: 'Turn turtle right.' },
    { label: 'left', insertText: 'left($0)', kind: 'function', detail: 'left(angle)', documentation: 'Turn turtle left.' },
    { label: 'penup', insertText: 'penup()', kind: 'function', detail: 'penup()', documentation: 'Pull the pen up.' },
    { label: 'pendown', insertText: 'pendown()', kind: 'function', detail: 'pendown()', documentation: 'Pull the pen down.' },
    { label: 'circle', insertText: 'circle($0)', kind: 'function', detail: 'circle(radius, extent=None)', documentation: 'Draw a circle with given radius.' },
    { label: 'color', insertText: 'color("$0")', kind: 'function', detail: 'color(*args)', documentation: 'Return or set pencolor and fillcolor.' },
    { label: 'pensize', insertText: 'pensize($0)', kind: 'function', detail: 'pensize(width)', documentation: 'Set line thickness.' },
    { label: 'done', insertText: 'done()', kind: 'function', detail: 'done()', documentation: 'Starts event loop or flushes drawing.' },
  ],
  np: [
    { label: 'array', insertText: 'array([$0])', kind: 'function', detail: 'array(object)', documentation: 'Create an array.' },
    { label: 'linspace', insertText: 'linspace($1, $2, $3)', kind: 'function', detail: 'linspace(start, stop, num=50)', documentation: 'Return evenly spaced numbers over interval.' },
    { label: 'arange', insertText: 'arange($0)', kind: 'function', detail: 'arange([start,] stop[, step,])', documentation: 'Return evenly spaced values.' },
    { label: 'zeros', insertText: 'zeros(($0))', kind: 'function', detail: 'zeros(shape)', documentation: 'Return a new array filled with zeros.' },
    { label: 'ones', insertText: 'ones(($0))', kind: 'function', detail: 'ones(shape)', documentation: 'Return a new array filled with ones.' },
    { label: 'mean', insertText: 'mean($0)', kind: 'function', detail: 'mean(a)', documentation: 'Compute arithmetic mean.' },
    { label: 'pi', insertText: 'pi', kind: 'variable', detail: '3.141592653589793', documentation: 'Mathematical constant pi.' },
  ],
  pd: [
    { label: 'DataFrame', insertText: 'DataFrame($0)', kind: 'class', detail: 'DataFrame(data=None)', documentation: 'Two-dimensional tabular data.' },
    { label: 'Series', insertText: 'Series($0)', kind: 'class', detail: 'Series(data=None)', documentation: 'One-dimensional ndarray with labels.' },
    { label: 'read_csv', insertText: 'read_csv("$0")', kind: 'function', detail: 'read_csv(filepath)', documentation: 'Read CSV into DataFrame.' },
    { label: 'concat', insertText: 'concat([$0])', kind: 'function', detail: 'concat(objs)', documentation: 'Concatenate pandas objects.' },
  ],
  df: [
    { label: 'head', insertText: 'head($0)', kind: 'function', detail: 'df.head(n=5)', documentation: 'Return the first n rows.' },
    { label: 'tail', insertText: 'tail($0)', kind: 'function', detail: 'df.tail(n=5)', documentation: 'Return the last n rows.' },
    { label: 'describe', insertText: 'describe()', kind: 'function', detail: 'df.describe()', documentation: 'Generate descriptive statistics.' },
    { label: 'info', insertText: 'info()', kind: 'function', detail: 'df.info()', documentation: 'Print a concise summary of a DataFrame.' },
    { label: 'groupby', insertText: 'groupby("$0")', kind: 'function', detail: 'df.groupby(by)', documentation: 'Group DataFrame using a mapper or series.' },
    { label: 'drop', insertText: 'drop(columns=[$0])', kind: 'function', detail: 'df.drop(labels=None, axis=0)', documentation: 'Drop specified labels from rows or columns.' },
    { label: 'fillna', insertText: 'fillna($0)', kind: 'function', detail: 'df.fillna(value)', documentation: 'Fill NA/NaN values using specified method.' },
    { label: 'dropna', insertText: 'dropna()', kind: 'function', detail: 'df.dropna()', documentation: 'Remove missing values.' },
    { label: 'sort_values', insertText: 'sort_values(by="$0")', kind: 'function', detail: 'df.sort_values(by)', documentation: 'Sort by the values along either axis.' },
    { label: 'columns', insertText: 'columns', kind: 'variable', detail: 'df.columns', documentation: 'The column labels of the DataFrame.' },
    { label: 'shape', insertText: 'shape', kind: 'variable', detail: 'df.shape', documentation: 'Return a tuple representing the dimensionality.' },
    { label: 'loc', insertText: 'loc[$0]', kind: 'variable', detail: 'df.loc[row, col]', documentation: 'Access a group of rows and columns by label(s).' },
    { label: 'iloc', insertText: 'iloc[$0]', kind: 'variable', detail: 'df.iloc[row, col]', documentation: 'Purely integer-location based indexing.' },
    { label: 'to_csv', insertText: 'to_csv("$0", index=False)', kind: 'function', detail: 'df.to_csv(path_or_buf)', documentation: 'Write object to a comma-separated values (csv) file.' },
  ],
  requests: [
    { label: 'get', insertText: 'get("$0")', kind: 'function', detail: 'get(url, **kwargs)', documentation: 'Sends a GET request.' },
    { label: 'post', insertText: 'post("$0", json={})', kind: 'function', detail: 'post(url, data=None, json=None, **kwargs)', documentation: 'Sends a POST request.' },
  ],
  std: [
    { label: 'cout', insertText: 'cout << $0 << std::endl;', kind: 'function', detail: 'std::ostream cout', documentation: 'Standard output stream.' },
    { label: 'cin', insertText: 'cin >> $0;', kind: 'function', detail: 'std::istream cin', documentation: 'Standard input stream.' },
    { label: 'endl', insertText: 'endl', kind: 'variable', documentation: 'Inserts newline and flushes stream.' },
    { label: 'vector', insertText: 'vector<${1:int}> $0;', kind: 'class', detail: 'std::vector<T>', documentation: 'Dynamic size sequence container.' },
    { label: 'string', insertText: 'string $0;', kind: 'class', detail: 'std::string', documentation: 'Standard character string.' },
    { label: 'sort', insertText: 'sort($1.begin(), $1.end());', kind: 'function', detail: 'void sort(RandomIt first, RandomIt last)', documentation: 'Sorts elements in range.' },
    { label: 'max', insertText: 'max($0, )', kind: 'function', detail: 'T max(a, b)', documentation: 'Returns the greater value.' },
    { label: 'min', insertText: 'min($0, )', kind: 'function', detail: 'T min(a, b)', documentation: 'Returns the smaller value.' },
  ],
};

// ---------------------------------------------------------------------------
// Context Scanner: extracts symbols from code and detects file contexts
// ---------------------------------------------------------------------------
export function getSuggestions(
  currentCode: string,
  cursorIndex: number,
  filePath: string,
  allFilePaths: string[] = [],
  allFiles: { path: string; content: string }[] = []
): { items: SuggestionItem[]; prefix: string; replaceStart: number } {
  const textBeforeCursor = currentCode.slice(0, cursorIndex);

  // 1. Detect VFS file completion (e.g. #include "...", new File("..."), open("..."))
  const quoteMatch = textBeforeCursor.match(/(?:new\s+File\s*\(\s*["']|open\s*\(\s*["']|FileReader\s*\(\s*["'])([^"'>]*)$/);
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

  // 1b. Detect C++ #include completion (local files + standard library headers)
  const includeMatch = textBeforeCursor.match(/#include\s*([<"][^>"\r\n]*)$/);
  if (includeMatch) {
    const rawPrefix = includeMatch[1]; // e.g. `<io` or `"util`
    const replaceStart = cursorIndex - rawPrefix.length;
    const isLocalQuote = rawPrefix.startsWith('"');
    const headerQuery = rawPrefix.slice(1).toLowerCase();

    const stdHeaders = [
      'iostream', 'vector', 'string', 'algorithm', 'cmath', 'fstream',
      'sstream', 'map', 'set', 'unordered_map', 'unordered_set', 'memory',
      'chrono', 'thread', 'queue', 'stack', 'numeric', 'cassert'
    ];

    const items: SuggestionItem[] = [];
    if (!isLocalQuote) {
      for (const h of stdHeaders) {
        if (h.toLowerCase().includes(headerQuery)) {
          items.push({
            label: `<${h}>`,
            insertText: `<${h}>`,
            kind: 'module',
            documentation: `Standard library header <${h}>`,
          });
        }
      }
    }

    for (const p of allFilePaths) {
      if (p === filePath) continue;
      const basename = p.split('/').pop() || p;
      if (basename.toLowerCase().includes(headerQuery)) {
        items.push({
          label: `"${basename}"`,
          insertText: `"${basename}"`,
          kind: 'file',
          detail: p,
          documentation: `Project virtual header: ${p}`,
        });
      }
    }

    return { items, prefix: rawPrefix, replaceStart };
  }

  // 2. Member Access Completion: e.g. `plt.`, `turtle.`, `np.`, `std::`
  const memberMatch = textBeforeCursor.match(/([A-Za-z0-9_]+)(?:\.|::)([A-Za-z0-9_]*)$/);
  if (memberMatch) {
    const objectName = memberMatch[1];
    const memberPrefix = memberMatch[2];
    const replaceStart = cursorIndex - memberPrefix.length;

    if (MEMBER_COMPLETIONS[objectName]) {
      const candidates = MEMBER_COMPLETIONS[objectName];
      const lower = memberPrefix.toLowerCase();
      const matched = candidates.filter((item) =>
        item.label.toLowerCase().startsWith(lower) || item.label.toLowerCase().includes(lower)
      );
      matched.sort((a, b) => {
        const aStarts = a.label.toLowerCase().startsWith(lower);
        const bStarts = b.label.toLowerCase().startsWith(lower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.label.length - b.label.length;
      });
      return {
        items: matched.slice(0, 15),
        prefix: memberPrefix,
        replaceStart,
      };
    }
  }

  // 3. Detect general word or member prefix
  const wordMatch = textBeforeCursor.match(/([A-Za-z0-9_$.:]+)$/);
  if (!wordMatch) {
    return { items: [], prefix: '', replaceStart: cursorIndex };
  }

  const prefix = wordMatch[1];
  let replaceStart = cursorIndex - prefix.length;
  const ext = filePath.split('.').pop()?.toLowerCase();

  // If the user is typing an import statement on the current line (e.g. `import pan` or `from pan`),
  // replace from the start of the import statement on this line so we don't end up with `import import pandas as pd`
  const lastNewlineIndex = textBeforeCursor.lastIndexOf('\n');
  const lineStart = lastNewlineIndex === -1 ? 0 : lastNewlineIndex + 1;
  const lineText = textBeforeCursor.slice(lineStart);
  const importLineMatch = lineText.match(/^([ \t]*)(?:from\s+[A-Za-z0-9_.]+\s+)?import\s+/);
  const fromLineMatch = lineText.match(/^([ \t]*)from\s+/);
  if (importLineMatch) {
    const indent = importLineMatch[1] || '';
    replaceStart = lineStart + indent.length;
  } else if (fromLineMatch) {
    const indent = fromLineMatch[1] || '';
    replaceStart = lineStart + indent.length;
  }

  // Base suggestions by language
  let baseSuggestions: SuggestionItem[] = [];
  if (ext === 'java') {
    baseSuggestions = JAVA_SUGGESTIONS;
  } else if (ext === 'cpp' || ext === 'hpp' || ext === 'cc' || ext === 'h') {
    baseSuggestions = CPP_SUGGESTIONS;
  } else if (ext === 'py') {
    baseSuggestions = PYTHON_SUGGESTIONS;
  }

  // 4. Extract symbols & functions declared in the current file AND other project files
  const identifiers = new Set<string>();
  const customFunctions: SuggestionItem[] = [];

  const filesToScan = allFiles.length > 0 ? allFiles : [{ path: filePath, content: currentCode }];

  for (const f of filesToScan) {
    const code = f.path === filePath ? currentCode : f.content;
    const isOtherFile = f.path !== filePath;

    // Scan Python function definitions: def my_func(a, b):
    const pyFuncRegex = /def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\):/g;
    let funcMatch: RegExpExecArray | null;
    while ((funcMatch = pyFuncRegex.exec(code)) !== null) {
      const fname = funcMatch[1];
      const params = funcMatch[2].trim();
      customFunctions.push({
        label: fname,
        insertText: `${fname}($0)`,
        kind: 'function',
        detail: `def ${fname}(${params})`,
        documentation: isOtherFile ? `Function from ${f.path}` : 'Locally defined function',
      });
    }

    // Scan C++ function definitions: void/int/double my_func(...) {
    const cppFuncRegex = /(?:void|int|double|float|bool|std::string|auto)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*\{/g;
    while ((funcMatch = cppFuncRegex.exec(code)) !== null) {
      const fname = funcMatch[1];
      const params = funcMatch[2].trim();
      if (fname !== 'main') {
        customFunctions.push({
          label: fname,
          insertText: `${fname}($0)`,
          kind: 'function',
          detail: `${fname}(${params})`,
          documentation: isOtherFile ? `Function from ${f.path}` : 'Locally defined function',
        });
      }
    }

    // Python variable assignments: e.g. df = pd.DataFrame(...), data = { ... }, x = 10
    const pyAssignRegex = /^[ \t]*([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/gm;
    let assignMatch: RegExpExecArray | null;
    while ((assignMatch = pyAssignRegex.exec(code)) !== null) {
      const varName = assignMatch[1];
      identifiers.add(varName);
    }

    // General identifiers (supports identifiers of length >= 1)
    const idRegex = /\b[A-Za-z_][A-Za-z0-9_]*\b/g;
    let match: RegExpExecArray | null;
    while ((match = idRegex.exec(code)) !== null) {
      const id = match[0];
      identifiers.add(id);
    }
  }

  const projectSymbols: SuggestionItem[] = Array.from(identifiers).map((id) => ({
    label: id,
    insertText: id,
    kind: 'variable',
    detail: 'Identifier',
  }));

  const all = [...customFunctions, ...baseSuggestions, ...projectSymbols];
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

    // Prioritize functions over generic raw identifiers
    if (a.kind === 'function' && b.kind !== 'function') return -1;
    if (a.kind !== 'function' && b.kind === 'function') return 1;

    return a.label.length - b.label.length;
  });

  // Deduplicate by label
  const seen = new Set<string>();
  const uniqueItems: SuggestionItem[] = [];
  for (const item of filtered) {
    if (!seen.has(item.label)) {
      seen.add(item.label);
      uniqueItems.push(item);
    }
  }

  return {
    items: uniqueItems.slice(0, 15),
    prefix,
    replaceStart,
  };
}
