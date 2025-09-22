import { useState } from "react"

interface InputBarProps {
    currentMessage: string;
    setCurrentMessage: (message: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    placeholder?: string;
    disabled?: boolean;
}

const InputBar = ({ currentMessage, setCurrentMessage, onSubmit, placeholder = "Ask me anything...", disabled = false }: InputBarProps) => {

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCurrentMessage(e.target.value)
    }

    return (
        <form onSubmit={onSubmit} className="p-6">
            <div className="max-w-4xl mx-auto">
                <div className="relative flex items-center bg-gray-50 rounded-xl border border-gray-200 focus-within:border-[#01953f] transition-colors">
                    <div className="flex items-center pl-4">
                        <button
                            type="button"
                            className="p-2 text-gray-400 hover:text-[#01953f] transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
                            </svg>
                        </button>
                    </div>

                    <input
                        type="text"
                        placeholder={placeholder}
                        value={currentMessage}
                        onChange={handleChange}
                        disabled={disabled}
                        className="flex-1 px-4 py-4 bg-transparent focus:outline-none text-gray-700 placeholder-gray-400 text-lg disabled:cursor-not-allowed disabled:opacity-50"
                    />

                    <div className="flex items-center pr-2">
                        <button
                            type="submit"
                            disabled={!currentMessage.trim() || disabled}
                            className="bg-[#01953f] hover:bg-[#01fb6a] hover:text-black disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-lg p-3 transition-all duration-200 group disabled:cursor-not-allowed"
                        >
                            <svg className="w-5 h-5 transform group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="text-center mt-3">
                    <p className="text-xs text-gray-500">
                        Velocity may display inaccurate info, including about people, so double-check its responses.
                    </p>
                </div>
            </div>
        </form>
    )
}

export default InputBar