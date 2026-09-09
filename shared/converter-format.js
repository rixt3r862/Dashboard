(function () {
  function valid(mode, digits) {
    return ["auto","decimal","significant"].includes(mode) && Number.isInteger(digits) &&
      digits >= (mode === "significant" ? 1 : 0) && digits <= 12;
  }
  function format(value, mode, digits) {
    if (!Number.isFinite(value)) return "";
    if (!valid(mode,digits)) { mode="auto"; digits=12; }
    if (Object.is(value,-0)) value=0;
    if (mode==="decimal") return value.toLocaleString("en-US",{minimumFractionDigits:digits,maximumFractionDigits:digits});
    if (mode==="significant") return value.toLocaleString("en-US",{maximumSignificantDigits:digits});
    return value.toLocaleString("en-US",{maximumSignificantDigits:12});
  }
  window.ConverterFormat={valid,format};
})();
