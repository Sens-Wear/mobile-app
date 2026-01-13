import { StyleSheet } from 'react-native';

export const colorPickerStyle = StyleSheet.create({
  title: {
    textAlign: 'center',
    marginVertical: 20,
  },
  picker: {
    gap: 20,
  },
  pickerContainer: {
    alignSelf: 'stretch',
    backgroundColor: '#fff',
    padding: 20,
  },
  panelStyle: {
    elevation: 5,
  },
  sliderStyle: {
    elevation: 5,
  },
  sliderVerticalStyle: {
    elevation: 5,
  },
  sliderTitle: {
    color: '#000',
    fontWeight: 'bold',
    marginBottom: 5,
    paddingHorizontal: 4,
  },
  previewStyle: {
    height: 40,
  },
  previewTxt: {
    color: '#707070',
  },
  inputStyle: {
    color: '#707070',
    paddingVertical: 2,
    borderColor: '#707070',
    fontSize: 12,
    marginLeft: 5,
  },
  swatchesContainer: {
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 10,
  },
  swatchStyle: {
    borderRadius: 20,
    height: 30,
    width: 30,
    margin: 0,
    marginBottom: 0,
    marginHorizontal: 0,
    marginVertical: 0,
  },
});
