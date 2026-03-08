import React, { useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  TextInput,
  FlatList,
  Modal,
} from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import {
  Concert,
  SpotifyArtist,
  initialsFromName,
  MONTHS,
  MIN_DATE,
  MAX_DATE,
  clampCursorToBounds,
  toYYYYMMDD,
  isValidDateYYYYMMDD,
} from "../utils/concertUtils";

/* ========================= Types ========================= */
type Option<T extends string | number> = {
  label: string;
  value: T;
};

const PICKER_ROW_HEIGHT = 44;
const PICKER_ROW_GAP = 8;
const PICKER_ITEM_HEIGHT = PICKER_ROW_HEIGHT + PICKER_ROW_GAP;

/* ========================= Components ========================= */
export function SearchBar(props: {
  searchQuery: string;
  onChangeSearch: (v: string) => void;
  onClearSearch: () => void;
}) {
  const { searchQuery, onChangeSearch, onClearSearch } = props;

  return (
    <View style={styles.searchCard}>
      <View style={styles.searchRow}>
        <TextInput
          value={searchQuery}
          onChangeText={onChangeSearch}
          placeholder="Search by headliner, venue, date…"
          placeholderTextColor="#66668a"
          style={[styles.searchInput, searchQuery ? { paddingRight: 44 } : null]}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />

        {searchQuery.trim().length > 0 && (
          <Pressable
            onPress={onClearSearch}
            style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.7 }]}
            hitSlop={10}
            accessibilityLabel="Clear search"
          >
            <Text style={styles.clearBtnText}>×</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function ConcertRow(props: {
  concert: Concert;
  isUpcoming: boolean;
  onOpenMenu: (c: Concert) => void;
}) {
  const { concert: c, isUpcoming, onOpenMenu } = props;

  return (
    <View style={styles.row}>
      {/* Headliner image (left) */}
      <View style={styles.avatarWrap}>
        {c.imageUrl ? (
          <Image source={{ uri: c.imageUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{initialsFromName(c.name)}</Text>
          </View>
        )}
      </View>

      {/* Info (right) */}
      <View style={{ flex: 1 }}>
        <View style={styles.rowTopLine}>
          <Text style={styles.rowTitle}>{c.name}</Text>
          {isUpcoming && (
            <View style={styles.badgeUpcoming}>
              <Text style={styles.badgeUpcomingText}>Upcoming</Text>
            </View>
          )}
        </View>

        {!!c.subName && <Text style={styles.rowSub}>{c.subName}</Text>}
        <Text style={styles.rowMeta}>
          {c.date} • {c.location}
        </Text>
      </View>

      <Pressable
        onPress={() => onOpenMenu(c)}
        style={({ pressed }) => [styles.moreBtn, pressed && { opacity: 0.6 }]}
        hitSlop={10}
      >
        <Text style={styles.moreBtnText}>⋯</Text>
      </Pressable>
    </View>
  );
}

export function OptionPickerModal<T extends string | number>(props: {
  visible: boolean;
  title: string;
  options: Option<T>[];
  selectedValue: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  const { visible, title, options, selectedValue, onSelect, onClose } = props;
  const listRef = useRef<FlatList<Option<T>>>(null);

  const selectedIndex = useMemo(() => {
    const i = options.findIndex((o) => o.value === selectedValue);
    return i >= 0 ? i : 0;
  }, [options, selectedValue]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: selectedIndex,
        animated: false,
        viewPosition: 0.5,
      });
    }, 0);
    return () => clearTimeout(t);
  }, [visible, selectedIndex]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <Pressable style={styles.pickerCard} onPress={() => {}}>
          <Text style={styles.pickerTitle}>{title}</Text>

          <FlatList
            ref={listRef}
            data={options}
            keyExtractor={(item) => String(item.value)}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: PICKER_ROW_GAP }} />}
            contentContainerStyle={{ paddingBottom: PICKER_ROW_GAP }}
            getItemLayout={(_, index) => ({
              length: PICKER_ITEM_HEIGHT,
              offset: PICKER_ITEM_HEIGHT * index,
              index,
            })}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                listRef.current?.scrollToIndex({
                  index: info.index,
                  animated: false,
                  viewPosition: 0.5,
                });
              }, 50);
            }}
            renderItem={({ item }) => {
              const isSelected = item.value === selectedValue;
              return (
                <Pressable
                  onPress={() => onSelect(item.value)}
                  style={({ pressed }) => [
                    styles.pickerRow,
                    isSelected && styles.pickerRowSelected,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={[
                      styles.pickerRowText,
                      isSelected && styles.pickerRowTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            }}
          />

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.pickerClose, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.pickerCloseText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function CalendarModal(props: {
  visible: boolean;
  date: string;
  calendarCursor: Date;
  setCalendarCursor: React.Dispatch<React.SetStateAction<Date>>;
  onPickDay: (day: DateData) => void;
  onClose: () => void;
}) {
  const { visible, date, calendarCursor, setCalendarCursor, onPickDay, onClose } = props;
  const [monthPickerOpen, setMonthPickerOpen] = React.useState(false);
  const [yearPickerOpen, setYearPickerOpen] = React.useState(false);

  const monthOptions = useMemo<Option<number>[]>(
    () => MONTHS.map((m, idx) => ({ label: m, value: idx })),
    []
  );

  const yearOptions = useMemo<Option<number>[]>(() => {
    const years: Option<number>[] = [];
    for (let y = 1945; y <= 2026; y++) years.push({ label: String(y), value: y });
    return years;
  }, []);

  const markedDates = useMemo(() => {
    if (!isValidDateYYYYMMDD(date)) return {};
    return { [date]: { selected: true, selectedColor: "#4f46e5" } };
  }, [date]);

  const monthKey = `${calendarCursor.getFullYear()}-${calendarCursor.getMonth()}`;
  const current = toYYYYMMDD(calendarCursor);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.calendarHeader}>
            <Pressable
              onPress={() => setMonthPickerOpen(true)}
              style={({ pressed }) => [styles.dropdown, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.dropdownText}>
                {MONTHS[calendarCursor.getMonth()]} ▾
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setYearPickerOpen(true)}
              style={({ pressed }) => [styles.dropdown, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.dropdownText}>{calendarCursor.getFullYear()} ▾</Text>
            </Pressable>
          </View>

          <Calendar
            key={monthKey}
            current={current}
            minDate={MIN_DATE}
            maxDate={MAX_DATE}
            onMonthChange={(m) =>
              setCalendarCursor(clampCursorToBounds(new Date(m.year, m.month - 1, 1)))
            }
            onDayPress={onPickDay}
            markedDates={markedDates}
            hideExtraDays
            enableSwipeMonths
            theme={{
              backgroundColor: "#161622",
              calendarBackground: "#161622",
              dayTextColor: "white",
              monthTextColor: "white",
              textDisabledColor: "#55557a",
              arrowColor: "white",
              todayTextColor: "#cfcfe6",
            }}
          />

          <OptionPickerModal
            visible={monthPickerOpen}
            title="Select Month"
            options={monthOptions}
            selectedValue={calendarCursor.getMonth()}
            onClose={() => setMonthPickerOpen(false)}
            onSelect={(monthIndex) => {
              setCalendarCursor((prev) =>
                clampCursorToBounds(new Date(prev.getFullYear(), monthIndex, 1))
              );
              setMonthPickerOpen(false);
            }}
          />

          <OptionPickerModal
            visible={yearPickerOpen}
            title="Select Year"
            options={yearOptions}
            selectedValue={calendarCursor.getFullYear()}
            onClose={() => setYearPickerOpen(false)}
            onSelect={(year) => {
              setCalendarCursor((prev) =>
                clampCursorToBounds(new Date(year, prev.getMonth(), 1))
              );
              setYearPickerOpen(false);
            }}
          />

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.modalClose, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.modalCloseText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function RowMenuModal(props: {
  visible: boolean;
  target: Concert | null;
  onClose: () => void;
  onEdit: (c: Concert) => void;
  onDelete: (id: string) => void;
}) {
  const { visible, target, onClose, onEdit, onDelete } = props;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.menuBackdrop} onPress={onClose}>
        <Pressable style={styles.menuCard} onPress={() => {}}>
          <Text style={styles.menuTitle}>Actions</Text>

          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.8 }]}
            onPress={() => {
              if (!target) return;
              onClose();
              onEdit(target);
            }}
          >
            <Text style={styles.menuItemText}>Edit</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              styles.menuItemDanger,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => {
              if (!target) return;
              const id = target.id;
              onClose();
              onDelete(id);
            }}
          >
            <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Delete</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.8 }]}
            onPress={onClose}
          >
            <Text style={styles.menuItemText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  searchCard: {
    backgroundColor: "#161622",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#24243a",
    marginBottom: 10,
  },
  searchRow: { position: "relative", justifyContent: "center" },
  searchInput: {
    backgroundColor: "#0f0f18",
    color: "white",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#2a2a44",
  },
  clearBtn: {
    position: "absolute",
    right: 8,
    height: 28,
    width: 28,
    borderRadius: 14,
    backgroundColor: "#1b1b2a",
    borderWidth: 1,
    borderColor: "#2a2a44",
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtnText: {
    color: "#cfcfe6",
    fontWeight: "900",
    fontSize: 18,
    marginTop: -2,
  },

  row: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#161622",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#24243a",
  },

  // Headliner image
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2a2a44",
    backgroundColor: "#0f0f18",
  },
  avatar: { width: "100%", height: "100%" },
  avatarPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f0f18",
  },
  avatarText: { color: "#cfcfe6", fontWeight: "900" },

  rowTopLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { color: "white", fontWeight: "800", fontSize: 16, flexShrink: 1 },
  rowSub: { color: "#cfcfe6", marginTop: 2 },
  rowMeta: { color: "#9a9ab5", marginTop: 6 },

  badgeUpcoming: {
    backgroundColor: "#1c1a3a",
    borderWidth: 1,
    borderColor: "#4f46e5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeUpcomingText: { color: "#cfcfe6", fontWeight: "800", fontSize: 12 },

  moreBtn: {
    alignSelf: "center",
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f0f18",
    borderWidth: 1,
    borderColor: "#2a2a44",
  },
  moreBtnText: {
    color: "white",
    fontSize: 22,
    fontWeight: "900",
    marginTop: -6,
  },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#161622",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#24243a",
    padding: 12,
  },

  calendarHeader: { flexDirection: "row", gap: 10, marginBottom: 10 },
  dropdown: {
    flex: 1,
    backgroundColor: "#0f0f18",
    borderWidth: 1,
    borderColor: "#2a2a44",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownText: { color: "white", fontWeight: "800" },

  modalClose: {
    marginTop: 10,
    backgroundColor: "#0f0f18",
    borderWidth: 1,
    borderColor: "#2a2a44",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCloseText: { color: "#cfcfe6", fontWeight: "800" },

  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 16,
  },
  pickerCard: {
    backgroundColor: "#161622",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#24243a",
    padding: 12,
    maxHeight: "75%",
  },
  pickerTitle: { color: "white", fontWeight: "900", fontSize: 16, marginBottom: 10 },

  pickerRow: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: "#0f0f18",
    borderWidth: 1,
    borderColor: "#2a2a44",
  },
  pickerRowSelected: { borderColor: "#4f46e5" },
  pickerRowText: { color: "#cfcfe6", fontWeight: "700" },
  pickerRowTextSelected: { color: "white" },

  pickerClose: {
    marginTop: 6,
    backgroundColor: "#0f0f18",
    borderWidth: 1,
    borderColor: "#2a2a44",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  pickerCloseText: { color: "#cfcfe6", fontWeight: "800" },

  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 16,
  },
  menuCard: {
    backgroundColor: "#161622",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#24243a",
    padding: 12,
  },
  menuTitle: { color: "white", fontWeight: "900", fontSize: 16, marginBottom: 10 },
  menuItem: {
    backgroundColor: "#0f0f18",
    borderWidth: 1,
    borderColor: "#2a2a44",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  menuItemText: { color: "#cfcfe6", fontWeight: "800", fontSize: 14 },
  menuItemDanger: { borderColor: "#4a2a2a", backgroundColor: "#2a1b1b" },
  menuItemTextDanger: { color: "#ffb4b4" },
});