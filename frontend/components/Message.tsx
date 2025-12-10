import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Clipboard,
  Alert,
} from "react-native";
import moment from "moment";
import Markdown from "react-native-markdown-display"; // Mobile-compatible Markdown
import {
  Feather,
  FontAwesome,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";

const CodeBlock = ({ children }: { children: string }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    Clipboard.setString(children);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <View style={styles.codeBlockWrapper}>
      <View style={styles.codeBlockHeader}>
        <Text style={styles.codeBlockLang}>Code</Text>
        <TouchableOpacity onPress={handleCopy} style={styles.codeBlockCopyBtn}>
          {isCopied ? (
            <>
              <Feather name="check" size={12} color="green" />
              <Text style={{ marginLeft: 5 }}>Copied</Text>
            </>
          ) : (
            <>
              <Feather name="copy" size={12} color="#000" />
              <Text style={{ marginLeft: 5 }}>Copy</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      <View style={styles.codeBlockContentWrapper}>
        <Text style={styles.codeBlockContent}>{children}</Text>
      </View>
    </View>
  );
};

const Message = ({ message }: { message: any }) => {
  const isUser = message.role === "user";

  const handleImageDownload = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission required",
          "Please grant storage permission to download image"
        );
        return;
      }

      const fileUri =
        FileSystem.documentDirectory + `ai-genify-${Date.now()}.png`;
      const downloadResumable = FileSystem.createDownloadResumable(
        message.content,
        fileUri
      );
      const { uri } = await downloadResumable.downloadAsync();
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("Downloaded", "Image saved to your gallery!");
    } catch (error) {
      console.log("Download failed", error);
      Alert.alert("Download failed", "Cannot download image");
    }
  };

  return (
    <View
      style={[
        styles.messageMainWrapper,
        { flexDirection: isUser ? "row-reverse" : "row" },
      ]}
    >
      <View style={styles.messageContentArea}>
        <View style={styles.avatarWrapper}>
          <View
            style={[
              styles.avatarBase,
              isUser ? styles.avatarUser : styles.avatarAI,
            ]}
          >
            {isUser ? (
              <FontAwesome name="user" size={12} color="#555" />
            ) : (
              <MaterialCommunityIcons
                name="auto-fix"
                size={12}
                color="#4f46e5"
              />
            )}
          </View>
        </View>

        <View
          style={[
            styles.textWrapper,
            { alignItems: isUser ? "flex-end" : "flex-start" },
          ]}
        >
          <View
            style={[
              styles.bubbleBase,
              isUser ? styles.bubbleUser : styles.bubbleAI,
            ]}
          >
            {isUser ? (
              <Text style={styles.userContent}>{message.content}</Text>
            ) : message.isImage ? (
              <TouchableOpacity onPress={handleImageDownload}>
                <Image source={{ uri: message.content }} style={styles.image} />
              </TouchableOpacity>
            ) : (
              <Markdown
                style={{
                  body: { color: "#333", fontSize: 14 },
                  code_inline: styles.inlineCode,
                  code_block: styles.codeBlockContent,
                }}
              >
                {message.content}
              </Markdown>
            )}
          </View>

          <View
            style={[
              styles.footer,
              { flexDirection: isUser ? "row-reverse" : "row" },
            ]}
          >
            <Text style={styles.timestamp}>
              {moment(message.timestamp).fromNow()}
            </Text>
            {!isUser && message.isImage && (
              <TouchableOpacity
                onPress={handleImageDownload}
                style={styles.downloadBtn}
              >
                <Feather name="download" size={12} color="#000" />
                <Text style={{ marginLeft: 5 }}>Download</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

export default Message;

const styles = StyleSheet.create({
  messageMainWrapper: { width: "100%", marginBottom: 10 },
  messageContentArea: { flex: 1, flexDirection: "row", gap: 10 },
  avatarWrapper: { justifyContent: "flex-end" },
  avatarBase: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarUser: {
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#ccc",
  },
  avatarAI: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#ccc" },
  textWrapper: { flex: 1 },
  bubbleBase: { padding: 10, borderRadius: 20, maxWidth: "90%" },
  bubbleUser: {
    backgroundColor: "#f9f9f9",
    borderColor: "#ccc",
    borderWidth: 1,
  },
  bubbleAI: { backgroundColor: "#fff", borderColor: "#ccc", borderWidth: 1 },
  userContent: { color: "#333" },
  image: { width: 200, height: 200, borderRadius: 10 },
  footer: { marginTop: 5, gap: 10, alignItems: "center" },
  timestamp: { fontSize: 10, color: "#888" },
  downloadBtn: { flexDirection: "row", alignItems: "center", marginLeft: 5 },
  codeBlockWrapper: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    marginVertical: 5,
  },
  codeBlockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 5,
    backgroundColor: "#eee",
  },
  codeBlockLang: { fontSize: 10, fontWeight: "bold" },
  codeBlockCopyBtn: { flexDirection: "row", alignItems: "center" },
  codeBlockContentWrapper: { padding: 5, backgroundColor: "#f8f8f8" },
  codeBlockContent: { fontFamily: "monospace", fontSize: 12 },
  inlineCode: {
    fontFamily: "monospace",
    backgroundColor: "#eee",
    paddingHorizontal: 3,
  },
});
