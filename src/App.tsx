import React, { useEffect, useState } from "react";
import { getTokenizer } from "./kuromojiApi";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Romanizer from "js-hira-kata-romanize";
import { schemeSet2 } from "d3-scale-chromatic";

const colors = schemeSet2;

// Romanizer を生成（オプションを指定）
const r = new Romanizer({
  chouon: Romanizer.CHOUON_SKIP,
  upper: Romanizer.UPPER_NONE,
});

// 母音列抽出
const getVowelSeq = (katakana: string) => {
  const romaji = r.romanize(katakana); // カタカナ→ローマ字
  return romaji.replace(/[^aeiou]/gi, ""); // 母音だけ抽出
};

// 韻検出（母音2文字以上）
const detectRhymes = (readings: string[]) => {
  const map: Record<string, number[]> = {};
  readings.forEach((r, i) => {
    const v = getVowelSeq(r);
    if (v.length < 2) return;
    if (!map[v]) map[v] = [];
    map[v].push(i);
  });
  return map;
};

export default function App() {
  const [text, setText] = useState("");
  const [tokens, setTokens] = useState<{ surface: string; reading: string }[]>(
    []
  );
  const [rhymeGroups, setRhymeGroups] = useState<Record<string, number[]>>({});
  const [rhymeDict, setRhymeDict] = useState<Record<string, string[]>>({});
  const [suggests, setSuggests] = useState<
    { vowelSeq: string; words: string[] }[]
  >([]);
  const [limitExceeded, setLimitExceeded] = useState(false);

  // 韻辞書をロード
  useEffect(() => {
    fetch(process.env.PUBLIC_URL +"/vowel_dictionary.json")
      .then((res) => res.json())
      .then(setRhymeDict);
  }, []);

  useEffect(() => {
    const setting = async () => {
      const tokenizer = await getTokenizer();
      const tks = tokenizer.tokenize(text).map((t) => ({
        surface: t.surface_form,
        reading: t.reading || t.surface_form,
      }));
      setTokens(tks);

      const map = detectRhymes(tks.map((t) => t.reading));
      const entries = Object.entries(map);
      if (entries.length > 8) {
        // 8個に制限
        const limitedEntries = entries.slice(0, 8);
        const limitedMap = Object.fromEntries(limitedEntries);

        setRhymeGroups(limitedMap);
        setLimitExceeded(true); // メッセージ用
      } else {
        setRhymeGroups(map);
        setLimitExceeded(false);
      }

      // サジェスト生成
      const newSuggests: { vowelSeq: string; words: string[] }[] = [];

      Object.keys(map).forEach((v) => {
        if (rhymeDict[v]) {
          // すでに文章中に出ている単語を除外
          const usedWords = tokens.map((t) => t.surface);
          const candidates = rhymeDict[v].filter((w) => !usedWords.includes(w));

          if (candidates.length > 0) {
            const shuffled = [...candidates].sort(() => Math.random() - 0.5);
            newSuggests.push({ vowelSeq: v, words: shuffled.slice(0, 3) });
          }
        }
      });

      setSuggests(newSuggests.slice(0, 3)); // 最大3グループ
    };
    setting();
  }, [text, rhymeDict]);

  // 母音列ごとの色マップ
  const rhymeColorMap: Record<string, string> = {};
  Object.keys(rhymeGroups).forEach((v, i) => {
    rhymeColorMap[v] = colors[i % colors.length];
  });

  return (
    <>
      {/* メイン */}
      <Box style={{ padding: 16, fontFamily: "sans-serif" }}>
        <Typography variant="h6">韻チェッカー</Typography>
        <Typography variant="caption">
          入力した文章の中から、母音の並びが同じ2音節以上の単語を韻としてハイライトします。
        </Typography>
        <Typography variant="caption">
          さらに、韻を踏める語をサジェストします。
        </Typography>
        {/* 入力エリア */}
        <TextField
          label="文章を入力してください"
          multiline
          rows={4}
          fullWidth
          variant="outlined"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ marginTop: 16 }}
        />
        {limitExceeded && (
          <Typography color="error" sx={{ mb: 1 }}>
            ※デモ版では、8 個以上の韻の種類は検知できません。
          </Typography>
        )}
        {/* 出力エリア */}
        <Box
          style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}
        >
          {tokens.map((t, i) => {
            let vowelSeq: string | undefined;

            // まず母音列を見つける
            Object.entries(rhymeGroups).forEach(
              ([v, idxs]) => {
                if (idxs.includes(i)) {
                  vowelSeq = v;
                }
              }
            );

            const baseColor = vowelSeq ? rhymeColorMap[vowelSeq] : undefined;
            const count = vowelSeq ? rhymeGroups[vowelSeq].length : 0;

            return (
              <Chip
                key={i}
                label={t.surface}
                style={{
                  backgroundColor: count >= 2 ? baseColor : "transparent",
                  borderColor: count >= 2 ? "transparent" : baseColor,
                }}
                variant={
                  !vowelSeq
                    ? "transparent"
                    : count >= 2
                    ? "transparent"
                    : "outlined"
                }
              ></Chip>
            );
          })}
        </Box>
        {/* サジェストエリア */}
        <Card
          variant="outlined"
          style={{
            marginTop: 12,
            marginBottom: 12,
            padding: "12px 16px",
            background: "#fafafa",
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1 }}>
            韻サジェスト
          </Typography>

          {suggests.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              サジェストはありません
            </Typography>
          )}

          {suggests.map((group) => {
            const baseColor = rhymeColorMap[group.vowelSeq] || "#ccc";
            const count = rhymeGroups[group.vowelSeq]?.length || 0;

            // // 文中で使われている単語
            // const usedWords = tokens
            //   .filter((t, i) => rhymeGroups[group.vowelSeq]?.includes(i))
            //   .map((t) => t.surface);

            return (
              <Box key={group.vowelSeq} style={{ marginBottom: 12 }}>
                {/* 音韻見出し */}
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: "monospace",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    mb: 0.5,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      marginRight: 8,
                      backgroundColor: baseColor,
                    }}
                  />
                  {group.vowelSeq}
                </Typography>
                {/* {usedWords.length > 0 && (
                  <Typography
                    style={{
                      marginLeft: 8,
                      fontWeight: "normal",
                      color: "#555",
                    }}
                  >
                    ({usedWords.join(", ")})
                  </Typography>
                )} */}

                {/* 候補語 */}
                <Box style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {group.words.map((w) => (
                    <Chip
                      key={w}
                      label={w}
                      style={{
                        backgroundColor: count >= 2 ? baseColor : undefined,
                        borderColor: count >= 2 ? undefined : baseColor,
                      }}
                      variant={count >= 2 ? undefined : "outlined"}
                    ></Chip>
                  ))}
                </Box>
              </Box>
            );
          })}
        </Card>
      </Box>
    </>
  );
}
