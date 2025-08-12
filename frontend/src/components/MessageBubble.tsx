import React from "react";
import { Message } from "../types";
import {
  FcGlobe,
  FcDocument,
  FcReading,
  FcAssistant,
  FcComboChart,
} from "react-icons/fc";
import { FaVectorSquare } from "react-icons/fa6";

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getContextIcon = (
    contextUsed?: string,
    usedWebSearch?: boolean
  ): JSX.Element => {
    if (contextUsed === "both") {
      return (
        <>
          <FcGlobe style={{ marginRight: 4 }} />
          <FcDocument />
        </>
      );
    }
    if (contextUsed === "web" || usedWebSearch) return <FcGlobe />;
    if (contextUsed === "document") return <FcDocument />;
    return <FcAssistant />;
  };

  const getContextLabel = (contextUsed?: string, usedWebSearch?: boolean) => {
    if (contextUsed === "both") return "Document + Web Search";
    if (contextUsed === "web" || usedWebSearch) return "Web Search";
    if (contextUsed === "document") return "Document";
    return "AI Response";
  };

  const isStockResponse = (content: string) => {
    return (
      content.toLowerCase().includes("stock") ||
      content.toLowerCase().includes("price") ||
      content.includes("$") ||
      content.toLowerCase().includes("market")
    );
  };

  const formatMessageContent = (content: string) => {
    const paragraphs = content.split("\n").filter((p) => p.trim());

    return paragraphs.map((paragraph, index) => {
      if (
        paragraph.startsWith("•") ||
        paragraph.startsWith("-") ||
        paragraph.match(/^\d+\./)
      ) {
        return (
          <div key={index} className="list-item">
            {paragraph}
          </div>
        );
      }

      if (
        paragraph.includes("$") ||
        paragraph.toLowerCase().includes("price:")
      ) {
        return (
          <div key={index} className="financial-data">
            {paragraph}
          </div>
        );
      }

      return <p key={index}>{paragraph}</p>;
    });
  };

  return (
    <div
      className={`message-bubble ${message.role} ${
        isStockResponse(message.content) ? "stock-response" : ""
      }`}
    >
      <div className="message-header">
        <div className="message-info">
          <span className="message-role">
            {message.role === "user" ? (
              <>
                {" "}
                <FcAssistant /> You
              </>
            ) : (
              <>
                {getContextIcon(message.contextUsed, message.usedWebSearch)}{" "}
                DocuChat AI
                <span className="context-label">
                  ({getContextLabel(message.contextUsed, message.usedWebSearch)}
                  )
                </span>
              </>
            )}
          </span>
          <span className="message-timestamp">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>

        {message.role === "assistant" && (
          <div className="message-indicators">
            {message.usedWebSearch && (
              <div
                className="indicator web-search"
                title="Enhanced with web search"
              >
                <FcGlobe />
              </div>
            )}
            {message.sources &&
              message.sources.length > 0 &&
              !message.usedWebSearch && (
                <div
                  className="indicator document"
                  title="Based on document content"
                >
                  <FcReading />
                </div>
              )}
            {isStockResponse(message.content) && (
              <div className="indicator stock" title="Financial/Stock data">
                <FcComboChart />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="message-content">
        {formatMessageContent(message.content)}

        {message.role === "assistant" && (
          <div className="message-footer">
            {message.usedWebSearch && message.contextUsed === "both" && (
              <div className="enhanced-indicator">
                <small>
                  <FaVectorSquare /> Enhanced with both document knowledge and
                  web search
                </small>
              </div>
            )}
            {message.usedWebSearch && message.contextUsed === "web" && (
              <div className="web-only-indicator">
                <small>
                  <FcGlobe /> Based on web search (no relevant document content
                  found)
                </small>
              </div>
            )}
            {!message.usedWebSearch &&
              message.sources &&
              message.sources.length > 0 && (
                <div className="document-only-indicator">
                  <small>
                    {" "}
                    <FcDocument /> Based on document content
                  </small>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
