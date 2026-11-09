import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LANGUAGE_OPTIONS, type LanguageCode } from "../store/languageStore";
import { translate } from "../utils/language";

type Props = {
  visible: boolean;
  language: LanguageCode;
  saving: boolean;
  onClose: () => void;
  onSelect: (value: LanguageCode) => void;
};

export default function LanguageModal({ visible, language, saving, onClose, onSelect }: Props) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <SafeAreaView className="flex-1 bg-black/30">
      <Pressable className="flex-1 items-center justify-center px-4" onPress={onClose}>
        <Pressable
          className="w-full max-w-[320px] overflow-hidden rounded-[14px] border border-[#E8E1E6] bg-white"
          onPress={(event) => event.stopPropagation()}
          accessibilityViewIsModal
        >
          <View className="border-b border-[#F2ECEF] px-5 py-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-[16px] text-[#1A1F36]" style={{ fontFamily: "Montserrat_600SemiBold" }}>{translate("Language", language)}</Text>
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={translate("Cancel", language)}>
                <Ionicons name="close-outline" size={22} color="#6F6F82" />
              </Pressable>
            </View>
            <Text className="mt-1 text-[12px] text-[#6F6F82]" style={{ fontFamily: "Montserrat_400Regular" }}>{translate("Choose your preferred language", language)}</Text>
          </View>
          {LANGUAGE_OPTIONS.map((option) => {
            const selected = option.value === language;
            return <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: saving }}
              disabled={saving}
              onPress={() => onSelect(option.value)}
              className={`flex-row items-center justify-between px-5 py-4 ${selected ? "bg-[#EFF6FF]" : "bg-white"}`}
            >
              <Text className={`text-[14px] ${selected ? "text-[#1D4ED8]" : "text-[#1A1F36]"}`} style={{ fontFamily: "Montserrat_400Regular" }}>{option.label}</Text>
              {saving && selected ? <ActivityIndicator size="small" color="#1D4ED8" /> : selected ? <Ionicons name="checkmark" size={20} color="#1D4ED8" /> : null}
            </Pressable>;
          })}
        </Pressable>
      </Pressable>
    </SafeAreaView>
  </Modal>;
}
