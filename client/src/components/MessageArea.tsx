import React from 'react';

interface SearchInfo {
    stages: string[];
    query: string;
    urls: string[] | string;
    error?: string;
}

interface Message {
    id: number;
    content: string;
    isUser: boolean;
    type: string;
    isLoading?: boolean;
    searchInfo?: SearchInfo;
}

interface SearchStagesProps {
    searchInfo: SearchInfo;
}

interface MessageAreaProps {
    messages: Message[];
}

const PremiumTypingAnimation = () => {
    return (
        <div className="flex items-center">
            <div className="flex items-center space-x-1.5">
                <div className="w-1.5 h-1.5 bg-theme-tertiary opacity-70 rounded-full animate-pulse"
                    style={{ animationDuration: "1s", animationDelay: "0ms" }}></div>
                <div className="w-1.5 h-1.5 bg-theme-tertiary opacity-70 rounded-full animate-pulse"
                    style={{ animationDuration: "1s", animationDelay: "300ms" }}></div>
                <div className="w-1.5 h-1.5 bg-theme-tertiary opacity-70 rounded-full animate-pulse"
                    style={{ animationDuration: "1s", animationDelay: "600ms" }}></div>
            </div>
        </div>
    );
};

const SearchStages = ({ searchInfo }: SearchStagesProps) => {
    if (!searchInfo || !searchInfo.stages || searchInfo.stages.length === 0) return null;

    return (
        <div className="mb-3 mt-1 relative pl-4">
            {/* Search Process UI */}
            <div className="flex flex-col space-y-4 text-sm text-theme-secondary">
                {/* Searching Stage */}
                {searchInfo.stages.includes('searching') && (
                    <div className="relative">
                        {/* Green dot */}
                        <div className="absolute -left-3 top-1 w-2.5 h-2.5 bg-[#01fb6a] rounded-full z-10 shadow-sm"></div>

                        {/* Connecting line to next item if reading exists */}
                        {searchInfo.stages.includes('reading') && (
                            <div className="absolute -left-[7px] top-3 w-0.5 h-[calc(100%+1rem)] bg-gradient-to-b from-[#01fb6a] to-[#01953f]"></div>
                        )}

                        <div className="flex flex-col">
                            <span className="font-medium mb-2 ml-2 text-theme-primary">Searching the web</span>

                            {/* Search Query in box styling */}
                            <div className="flex flex-wrap gap-2 pl-2 mt-1">
                                <div className="bg-theme-tertiary text-xs px-3 py-1.5 rounded border border-theme-primary inline-flex items-center">
                                    <svg className="w-3 h-3 mr-1.5 text-theme-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                    </svg>
                                    {searchInfo.query}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Reading Stage */}
                {searchInfo.stages.includes('reading') && (
                    <div className="relative">
                        {/* Green dot */}
                        <div className="absolute -left-3 top-1 w-2.5 h-2.5 bg-[#01fb6a] rounded-full z-10 shadow-sm"></div>

                        <div className="flex flex-col">
                            <span className="font-medium mb-2 ml-2 text-theme-primary">Reading</span>

                            {/* Search Results */}
                            {searchInfo.urls && searchInfo.urls.length > 0 && (
                                <div className="pl-2 space-y-1">
                                    <div className="flex flex-wrap gap-2">
                                        {Array.isArray(searchInfo.urls) ? (
                                            searchInfo.urls.map((url, index) => (
                                                <div key={index} className="bg-theme-tertiary text-xs px-3 py-1.5 rounded border border-theme-primary truncate max-w-[200px] transition-all duration-200 hover:bg-theme-secondary">
                                                    {typeof url === 'string' ? url : JSON.stringify(url).substring(0, 30)}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="bg-theme-tertiary text-xs px-3 py-1.5 rounded border border-theme-primary truncate max-w-[200px] transition-all duration-200 hover:bg-theme-secondary">
                                                {typeof searchInfo.urls === 'string' ? searchInfo.urls.substring(0, 30) : JSON.stringify(searchInfo.urls).substring(0, 30)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Writing Stage */}
                {searchInfo.stages.includes('writing') && (
                    <div className="relative">
                        {/* Green dot with subtle glow effect */}
                        <div className="absolute -left-3 top-1 w-2.5 h-2.5 bg-[#01fb6a] rounded-full z-10 shadow-sm"></div>
                        <span className="font-medium pl-2 text-theme-primary">Writing answer</span>
                    </div>
                )}

                {/* Error Message */}
                {searchInfo.stages.includes('error') && (
                    <div className="relative">
                        {/* Red dot over the vertical line */}
                        <div className="absolute -left-3 top-1 w-2.5 h-2.5 bg-red-400 rounded-full z-10 shadow-sm"></div>
                        <span className="font-medium text-theme-primary">Search error</span>
                        <div className="pl-4 text-xs text-red-500 mt-1">
                            {searchInfo.error || "An error occurred during search."}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const MessageArea = ({ messages }: MessageAreaProps) => {
    // Function to parse content and render with custom formatting
    const parseAndRenderContent = (content: string) => {
        // Split content into lines for processing
        const lines = content.split('\n');
        const elements: React.ReactNode[] = [];
        let lineKey = 0;

        for (let i = 0; i < lines.length; i++) {
            const currentLine = lines[i];
            const nextLine = lines[i + 1];

            // Check if current line is just a number (like "1.") and next line starts with bold text
            if (currentLine.match(/^\d+\.\s*$/) && nextLine && nextLine.match(/^\*\*[^*]+\*\*/)) {
                // Combine them and process
                const combinedLine = currentLine.trim() + nextLine + ' ';
                elements.push(renderLineWithFormatting(combinedLine, lineKey++));
                i++; // Skip the next line since we've processed it
            } else if (currentLine.trim()) {
                elements.push(renderLineWithFormatting(currentLine, lineKey++));
            } else {
                // Empty line - add spacing
                elements.push(<br key={lineKey++} />);
            }
        }

        return elements;
    };

    // Function to render a line with bold text and read more links
    const renderLineWithFormatting = (line: string, key: number) => {
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let partKey = 0;

        // Find bold text patterns **text**
        const boldRegex = /\*\*([^*]+)\*\*/g;
        let match;

        while ((match = boldRegex.exec(line)) !== null) {
            // Add text before the bold part
            if (match.index > lastIndex) {
                parts.push(line.substring(lastIndex, match.index));
            }

            // Add the bold text
            parts.push(<strong key={`${key}-${partKey++}`} className="font-semibold">{match[1]}</strong>);
            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < line.length) {
            let remainingText = line.substring(lastIndex);

            // Check for read more patterns and add links
            const readMorePattern = /(Read more on|Explore more on)\s+([A-Z][A-Za-z\s]+)\.?$/;
            const sourcePattern = /\.\s+(NBC News|ABC News|CNN|BBC|Reuters|AP News|Fox News)\.?$/;

            if (readMorePattern.test(remainingText)) {
                remainingText = remainingText.replace(readMorePattern, (match, prefix, source) => {
                    parts.push(
                        <span key={`${key}-${partKey++}`}>
                            {remainingText.substring(0, remainingText.indexOf(match))}
                            <a
                                href="#"
                                className="text-[#01953f] hover:text-[#01fb6a] underline text-sm font-medium ml-1"
                                onClick={(e) => e.preventDefault()}
                            >
                                {prefix} {source}
                            </a>
                        </span>
                    );
                    return '';
                });
            } else if (sourcePattern.test(remainingText)) {
                remainingText = remainingText.replace(sourcePattern, (match, source) => {
                    const beforeMatch = remainingText.substring(0, remainingText.indexOf(match));
                    parts.push(
                        <span key={`${key}-${partKey++}`}>
                            {beforeMatch}.{' '}
                            <a
                                href="#"
                                className="text-[#01953f] hover:text-[#01fb6a] underline text-sm font-medium"
                                onClick={(e) => e.preventDefault()}
                            >
                                Read more on {source}
                            </a>
                        </span>
                    );
                    return '';
                });
            } else {
                parts.push(remainingText);
            }
        }

        return (
            <div key={key} className="mb-3 leading-relaxed">
                {parts}
            </div>
        );
    };

    return (
        <div className="flex-grow overflow-y-auto" style={{ minHeight: 0 }}>
            <div className="max-w-4xl mx-auto p-6">
                {messages.map((message) => (
                    <div key={message.id} className={`mb-8`}>
                        {message.isUser ? (
                            // User Message
                            <div className="flex justify-end">
                                <div className="max-w-[70%] bg-[#01953f] text-white rounded-2xl rounded-br-md px-6 py-4 shadow-sm">
                                    <p className="text-white leading-relaxed">{message.content}</p>
                                </div>
                            </div>
                        ) : (
                            // AI Message
                            <div className="flex">
                                <div className="w-8 h-8 rounded-full bg-[#01953f] flex items-center justify-center mr-4 mt-1 flex-shrink-0">
                                    <img
                                        src="https://velocity.idevelopment.site/uploads/shape_27_1_1d90ad6dd8.svg"
                                        alt="Velocity"
                                        className="w-5 h-5"
                                    />
                                </div>
                                <div className="flex-1">
                                    {/* Search Status Display - Above the message */}
                                    {message.searchInfo && (
                                        <SearchStages searchInfo={message.searchInfo} />
                                    )}

                                    {/* Message Content */}
                                    <div className="prose prose-gray max-w-none">
                                        {message.isLoading ? (
                                            <div className="flex items-center space-x-2 text-theme-secondary">
                                                <PremiumTypingAnimation />
                                                <span className="text-sm">Thinking...</span>
                                            </div>
                                        ) : (
                                            <div className="text-theme-primary leading-relaxed">
                                                {message.content ? (
                                                    <div className="max-w-none leading-relaxed">
                                                        {parseAndRenderContent(message.content)}
                                                    </div>
                                                ) : (
                                                    <span className="text-theme-tertiary text-sm italic">Waiting for response...</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MessageArea;